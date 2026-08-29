/**
 * L'elenco dei kit, per gli admin.
 *
 * Un kit è una scorciatoia del catalogo — «kit audio base» invece di sette
 * righe da spuntare a mano — e non entra mai nella disponibilità: quella
 * guarda solo i `RequestItem` (regola 3 in CLAUDE.md). Qui si vede quindi
 * solo cosa contiene, mai se è libero.
 *
 * Ogni riga porta i primi pezzi in chiaro: il nome di un kit invecchia male —
 * «kit audio» resta uguale mentre dentro cambiano le casse — e l'elenco dei
 * pezzi è l'unica cosa che dice davvero cosa si sta per prestare.
 */

import { Link } from "react-router";
import type { Route } from "./+types/admin.kits";
import { PageShell, PageTitle } from "~/components/page";
import { ButtonLink } from "~/components/button";
import { AdminTabs } from "~/components/admin-tabs";
import { pageTitle } from "~/i18n/meta";
import { db } from "~/lib/db.server";
import { requireAdmin } from "~/lib/session.server";
import { useT } from "~/i18n/use-t";

/** Oltre questi, l'elenco si accorcia: come nella scheda del catalogo. */
const PREVIEW = 5;

export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "kits.heading") }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);

  const kits = await db.kit.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      assets: {
        orderBy: { sortOrder: "asc" },
        select: { asset: { select: { id: true, name: true } } },
      },
    },
  });

  return { kits };
}

export default function AdminKits({ loaderData }: Route.ComponentProps) {
  const { kits } = loaderData;
  const t = useT();

  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
        <PageTitle
          title={t("kits.heading")}
          intro={t("kits.intro")}
          actions={
            <ButtonLink to="/admin/kits/new" variant="primary">
              {t("kits.new")}
            </ButtonLink>
          }
        />

        <div className="mt-6">
          <AdminTabs />
        </div>

        {kits.length === 0 ? (
          <p className="mt-16 text-center text-muted">{t("kits.empty")}</p>
        ) : (
          <ul className="mt-6 flex flex-col gap-2">
            {kits.map((kit) => {
              const names = kit.assets.map((link) => link.asset.name);
              const hidden = names.length - PREVIEW;

              return (
                <li key={kit.id} className="rounded-sm border border-rule bg-card">
                  <Link to={`/admin/kits/${kit.id}`} className="block p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="text-sm font-medium hover:text-accent">{kit.name}</p>
                      <span className="font-mono text-2xs uppercase tracking-wider text-muted">
                        {t("kit.itemCount", { count: names.length })}
                      </span>
                    </div>

                    {kit.description && (
                      <p className="mt-1 text-sm text-muted">{kit.description}</p>
                    )}

                    <p className="mt-1 text-sm text-muted">
                      {names.length === 0
                        ? t("kits.emptyKit")
                        : names.slice(0, PREVIEW).join(" · ") +
                          (hidden > 0 ? ` · ${t("kit.more", { count: hidden })}` : "")}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PageShell>
    </main>
  );
}
