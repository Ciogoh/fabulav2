/**
 * La coda di approvazione.
 *
 * Prima di questa pagina un admin scopriva una richiesta in attesa solo
 * incappandoci per caso sul calendario. Qui sono tutte, più vecchie prima —
 * si smaltiscono in ordine. Nessuna action qui dentro: ogni riga porta al
 * dettaglio (`/requests/:id`), dove approva/rifiuta/chat esistono già.
 */

import { Link } from "react-router";
import type { Route } from "./+types/admin.requests";
import { db } from "~/lib/db.server";
import { requireAdmin } from "~/lib/session.server";
import { useFormatDay, useT } from "~/i18n/use-t";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Fabula" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const url = new URL(request.url);
  const showAll = url.searchParams.get("all") === "1";

  const requests = await db.request.findMany({
    where: showAll ? undefined : { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      status: true,
      user: { select: { name: true, email: true } },
      items: { select: { asset: { select: { name: true } } } },
    },
  });

  return {
    showAll,
    requests: requests.map((r) => ({
      id: r.id,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      status: r.status,
      holderName: r.user.name,
      holderEmail: r.user.email,
      itemNames: r.items.map((item) => item.asset.name),
    })),
  };
}

const STATUS_LABELS = {
  PENDING: "requests.status.pending",
  APPROVED: "requests.status.approved",
  REJECTED: "requests.status.rejected",
  CANCELLED: "requests.status.cancelled",
} as const;

export default function AdminRequests({ loaderData }: Route.ComponentProps) {
  const { requests, showAll } = loaderData;
  const t = useT();
  const formatDay = useFormatDay();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-24 pt-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {t("adminQueue.heading")}
        </h1>
        <Link
          to={showAll ? "/admin/requests" : "/admin/requests?all=1"}
          className="text-sm text-muted underline underline-offset-4 hover:text-ink"
        >
          {showAll ? t("adminQueue.showPending") : t("adminQueue.showAll")}
        </Link>
      </div>

      {requests.length === 0 ? (
        <p className="mt-16 text-center text-muted">{t("adminQueue.empty")}</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {requests.map((r) => (
            <li key={r.id}>
              <Link
                to={`/requests/${r.id}`}
                className="block rounded border border-rule bg-card p-4 hover:border-accent"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[0.68rem] uppercase tracking-widest text-faint">
                    {formatDay(r.startDate)} — {formatDay(r.endDate)}
                  </span>
                  <span className="rounded-full bg-sunk px-2 py-0.5 font-mono text-[0.66rem] font-medium uppercase tracking-wider text-muted">
                    {t(STATUS_LABELS[r.status])}
                  </span>
                </div>
                <p className="mt-2 text-sm">
                  {t("requests.admin.requestedBy")}{" "}
                  <strong className="font-medium">{r.holderName}</strong>{" "}
                  <span className="text-muted">({r.holderEmail})</span>
                </p>
                <p className="mt-1 text-sm text-muted">{r.itemNames.join(" · ")}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
