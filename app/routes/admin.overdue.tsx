/**
 * Gli oggetti in ritardo.
 *
 * Il promemoria automatico parte da solo via email (`lib/reminders.server.ts`),
 * ma prima di questa pagina non c'era un modo per un admin di vedere a colpo
 * d'occhio chi ha ancora qualcosa fuori scaduto, senza aprire ogni richiesta
 * una per una. Stesso schema di `admin.requests.tsx`: nessuna azione qui
 * dentro, ogni riga porta al dettaglio dove riconsegna e promemoria a mano
 * esistono già.
 *
 * «In ritardo» è per oggetto (`RequestItem`), non per richiesta: una
 * riconsegna parziale libera subito i pezzi tornati (regola 2), quindi una
 * richiesta con tre oggetti può averne solo uno ancora in ritardo. La query
 * seleziona già solo quelli.
 */

import { Link } from "react-router";
import type { Route } from "./+types/admin.overdue";
import { PageShell } from "~/components/page";
import { pageTitle } from "~/i18n/meta";
import { PersonInline } from "~/components/person";
import { db } from "~/lib/db.server";
import { requireAdmin } from "~/lib/session.server";
import { todayUtc } from "~/lib/availability.server";
import { useFormatDay, useT } from "~/i18n/use-t";

export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "overdue.heading") }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const today = todayUtc();

  const requests = await db.request.findMany({
    where: {
      status: "APPROVED",
      endDate: { lt: today },
      items: { some: { pickedUpAt: { not: null }, returnedAt: null, asset: { archivedAt: null } } },
    },
    // Le più vecchie prima: chi ha in mano un oggetto da più tempo è la
    // priorità di chi smaltisce l'elenco dall'alto.
    orderBy: { endDate: "asc" },
    select: {
      id: true,
      endDate: true,
      user: {
        select: { name: true, firstName: true, lastName: true, alias: true, image: true, email: true },
      },
      items: {
        where: { pickedUpAt: { not: null }, returnedAt: null, asset: { archivedAt: null } },
        select: { asset: { select: { name: true } } },
      },
    },
  });

  return {
    requests: requests.map((r) => ({
      id: r.id,
      endDate: r.endDate.toISOString(),
      daysLate: Math.round((today.getTime() - r.endDate.getTime()) / 86_400_000),
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

export default function AdminOverdue({ loaderData }: Route.ComponentProps) {
  const { requests } = loaderData;
  const t = useT();
  const formatDay = useFormatDay();

  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {t("overdue.heading")}
        </h1>

        {requests.length === 0 ? (
          <p className="mt-16 text-center text-muted">{t("overdue.empty")}</p>
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
                      {t("overdue.dueOn", { date: formatDay(r.endDate) })}
                    </span>
                    <span className="rounded-full bg-out-bg px-2 py-0.5 font-mono text-[0.66rem] font-medium uppercase tracking-wider text-out">
                      {t("overdue.daysLate", { count: r.daysLate })}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">
                    {t("requests.admin.requestedBy")} <PersonInline person={r.holder} />{" "}
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
