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
import { PageShell } from "~/components/page";
import { pageTitle } from "~/i18n/meta";
import { Avatar, PersonName } from "~/components/person";
import { db } from "~/lib/db.server";
import { requireAdmin } from "~/lib/session.server";
import { REQUEST_STATUS_LABELS } from "~/lib/request-status";
import { useFormatDay, useT } from "~/i18n/use-t";

export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "adminQueue.heading") }];
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
      user: {
        select: {
          name: true,
          firstName: true,
          lastName: true,
          alias: true,
          image: true,
          email: true,
        },
      },
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
      holder: {
        name: r.user.name,
        firstName: r.user.firstName,
        lastName: r.user.lastName,
        alias: r.user.alias,
        image: r.user.image,
      },
      holderEmail: r.user.email,
      itemNames: r.items.map((item) => item.asset.name),
    })),
  };
}

export default function AdminRequests({ loaderData }: Route.ComponentProps) {
  const { requests, showAll } = loaderData;
  const t = useT();
  const formatDay = useFormatDay();

  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
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
                    <span className="font-mono text-[0.68rem] uppercase tracking-widest text-muted">
                      {formatDay(r.startDate)} — {formatDay(r.endDate)}
                    </span>
                    <span className="rounded-full bg-sunk px-2 py-0.5 font-mono text-[0.66rem] font-medium uppercase tracking-wider text-muted">
                      {t(REQUEST_STATUS_LABELS[r.status])}
                    </span>
                  </div>
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span>{t("requests.admin.requestedBy")}</span>
                    <Avatar person={r.holder} size="sm" />
                    <PersonName person={r.holder} className="font-medium" />
                    <span className="text-muted">({r.holderEmail})</span>
                  </p>
                  <p className="mt-1 text-sm text-muted">{r.itemNames.join(" · ")}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PageShell>
    </main>
  );
}
