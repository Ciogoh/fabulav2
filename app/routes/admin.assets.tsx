/**
 * L'elenco degli oggetti, per gli admin.
 *
 * L'interruttore "non disponibile" è qui, a un click — non serve aprire la
 * scheda intera solo per segnare che qualcosa è in riparazione.
 */

import { Link, useFetcher } from "react-router";
import type { Route } from "./+types/admin.assets";
import { db } from "~/lib/db.server";
import { requireAdmin } from "~/lib/session.server";
import { useT } from "~/i18n/use-t";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Fabula" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);

  const assets = await db.asset.findMany({
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      isBookable: true,
      category: { select: { name: true } },
      photos: { orderBy: { sortOrder: "asc" }, take: 1, select: { thumbUrl: true } },
    },
  });

  return { assets };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
  const id = String(form.get("id") ?? "");

  const asset = await db.asset.findUnique({ where: { id }, select: { isBookable: true } });
  if (!asset) return { ok: false as const };

  await db.asset.update({ where: { id }, data: { isBookable: !asset.isBookable } });
  return { ok: true as const };
}

export default function AdminAssets({ loaderData }: Route.ComponentProps) {
  const { assets } = loaderData;
  const t = useT();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-24 pt-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {t("assets.heading")}
        </h1>
        <Link
          to="/admin/assets/new"
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          {t("assets.new")}
        </Link>
      </div>

      {assets.length === 0 ? (
        <p className="mt-16 text-center text-muted">{t("assets.empty")}</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {assets.map((asset) => (
            <AssetRow key={asset.id} asset={asset} />
          ))}
        </ul>
      )}
    </main>
  );
}

type AssetRow = Route.ComponentProps["loaderData"]["assets"][number];

function AssetRow({ asset }: { asset: AssetRow }) {
  const t = useT();
  const fetcher = useFetcher<typeof action>();
  // Ottimista: mentre la richiesta è in volo si mostra già lo stato nuovo,
  // così il click sembra immediato invece di aspettare il giro col server.
  const pendingBookable =
    fetcher.state !== "idle" ? !asset.isBookable : asset.isBookable;

  return (
    <li className="flex items-center gap-3 rounded border border-rule bg-card p-3">
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-sunk">
        {asset.photos[0]?.thumbUrl && (
          <img
            src={asset.photos[0].thumbUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <Link to={`/admin/assets/${asset.id}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium hover:text-accent">{asset.name}</p>
        {asset.category && (
          <p className="font-mono text-[0.65rem] uppercase tracking-wider text-faint">
            {asset.category.name}
          </p>
        )}
      </Link>

      {!pendingBookable && (
        <span className="font-mono text-[0.65rem] uppercase tracking-wider text-faint">
          {t("state.notBookable")}
        </span>
      )}

      <fetcher.Form method="post">
        <input type="hidden" name="id" value={asset.id} />
        <button
          type="submit"
          className="rounded border border-rule px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent"
        >
          {pendingBookable ? t("assets.makeUnavailable") : t("assets.makeAvailable")}
        </button>
      </fetcher.Form>
    </li>
  );
}
