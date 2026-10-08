/** Inbox del prestatore: soltanto le proprie pratiche, ordinate per il lavoro da fare. */
import { Form, Link } from "react-router";
import type { Route } from "./+types/account.lending";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";
import { unreadForLenderIds } from "~/lib/inbox.server";
import { PERSON_SELECT } from "~/lib/asset-proposals.server";
import { formatDay } from "~/lib/availability.server";
import { REQUEST_STATUS_LABELS } from "~/lib/request-status";
import { PageShell, PageTitle } from "~/components/page";
import { ButtonLink } from "~/components/button";
import { PersonName } from "~/components/person";
import { useFormatDay, useT } from "~/i18n/use-t";
import { pageTitle } from "~/i18n/meta";
import { useLive } from "~/lib/use-live";
export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "p2p.lending") }];
}
export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const history = new URL(request.url).searchParams.get("history") === "1";
  const unread = new Set(await unreadForLenderIds(user.id));
  const loans = await db.request.findMany({
    where: {
      lenderId: user.id,
      ...(!history
        ? {
            OR: [
              { status: "PENDING" as const },
              {
                status: "APPROVED" as const,
                items: {
                  some: { returnedAt: null, asset: { archivedAt: null } },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: { startDate: "asc" },
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      user: { select: PERSON_SELECT },
      items: {
        select: {
          pickedUpAt: true,
          returnedAt: true,
          asset: { select: { name: true, archivedAt: true } },
        },
      },
    },
  });
  return {
    history,
    loans: loans
      .map((r) => ({
        ...r,
        startDate: formatDay(r.startDate),
        endDate: formatDay(r.endDate),
        unread: unread.has(r.id),
      }))
      .sort(
        (a, b) =>
          Number(b.status === "PENDING") - Number(a.status === "PENDING") ||
          Number(b.unread) - Number(a.unread) ||
          a.startDate.localeCompare(b.startDate),
      ),
  };
}
export default function Lending({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const format = useFormatDay();
  useLive("/api/stream?lending=1");
  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
        <PageTitle
          title={t("p2p.lending")}
          intro={t("p2p.lenderIntro")}
          actions={
            <ButtonLink to="/account/items" variant="quiet">
              {t("p2p.myItems")}
            </ButtonLink>
          }
        />
        <div className="mt-5 flex flex-wrap gap-2">
          <ButtonLink
            to="/account/lending"
            variant={!loaderData.history ? "primary" : "quiet"}
          >
            {t("p2p.activeLoans")}
          </ButtonLink>
          <ButtonLink
            to="/account/lending?history=1"
            variant={loaderData.history ? "primary" : "quiet"}
          >
            {t("p2p.all")}
          </ButtonLink>
        </div>
        {!loaderData.loans.length && (
          <p className="mt-8 rounded-sm border border-dashed border-rule p-6 text-muted">
            {t("p2p.emptyLending")}
          </p>
        )}
        <ul className="mt-6 flex flex-col gap-3">
          {loaderData.loans.map((r) => (
            <li key={r.id}>
              <Link
                to={`/requests/${r.id}`}
                className="block rounded-sm border border-rule bg-card p-4 hover:border-accent"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <h2 className="max-w-full break-words font-medium">
                    {r.items
                      .map(
                        (i) =>
                          i.asset.name +
                          (i.asset.archivedAt ? ` (${t("p2p.archived")})` : ""),
                      )
                      .join(" · ")}
                  </h2>
                  <span className="font-mono text-xs text-muted">
                    {t(REQUEST_STATUS_LABELS[r.status])}
                  </span>
                </div>
                <p className="mt-2 text-sm">
                  <PersonName person={r.user} /> · {format(r.startDate)} —{" "}
                  {format(r.endDate)}
                </p>
                {r.status === "APPROVED" && (
                  <p className="mt-2 text-xs text-muted">
                    {r.items.filter((i) => i.returnedAt).length}/
                    {r.items.length} {t("requests.item.returned")}
                  </p>
                )}
                {r.unread && (
                  <p className="mt-2 text-sm font-medium text-accent">
                    {t("p2p.unread")}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </PageShell>
    </main>
  );
}
