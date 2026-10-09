/** Riepilogo del lotto: ogni prestatore continua a vedere soltanto la sua richiesta. */
import type { Route } from "./+types/requests.batches.$id";
import { useLive } from "~/lib/use-live";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";
import { PERSON_SELECT } from "~/lib/asset-proposals.server";
import { formatDay } from "~/lib/availability.server";
import { REQUEST_STATUS_LABELS } from "~/lib/request-status";
import { PageShell, PageTitle } from "~/components/page";
import { ButtonLink } from "~/components/button";
import { PersonName } from "~/components/person";
import { pageTitle } from "~/i18n/meta";
import { useT, useFormatDay } from "~/i18n/use-t";
export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "p2p.batchHeading") }];
}
export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const batch = await db.requestBatch.findFirst({
    where: {
      id: params.id,
      ...(user.role !== "ADMIN" ? { userId: user.id } : {}),
    },
    select: {
      id: true,
      requests: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          lender: { select: PERSON_SELECT },
          items: { select: { asset: { select: { name: true } } } },
        },
      },
    },
  });
  if (!batch) throw new Response("Not found", { status: 404 });
  return {
    id: batch.id,
    requests: batch.requests.map((r) => ({
      ...r,
      startDate: formatDay(r.startDate),
      endDate: formatDay(r.endDate),
    })),
  };
}
export default function Batch({ loaderData }: Route.ComponentProps) {
  useLive(`/api/stream?batch=${loaderData.id}`);
  const t = useT();
  const format = useFormatDay();
  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
        <PageTitle title={t("p2p.batchHeading")} intro={t("p2p.batchIntro")} />
        <ul className="mt-6 flex flex-col gap-4">
          {loaderData.requests.map((r) => (
            <li
              key={r.id}
              className="rounded-sm border border-rule bg-card p-5"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <h2 className="font-medium">
                  {r.lender ? (
                    <PersonName person={r.lender} />
                  ) : (
                    "Material Matters"
                  )}
                </h2>
                <span className="font-mono text-xs text-muted">
                  {t(REQUEST_STATUS_LABELS[r.status])}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted">
                {format(r.startDate)} — {format(r.endDate)}
              </p>
              <p className="mt-3 break-words text-sm">
                {r.items.map((i) => i.asset.name).join(" · ")}
              </p>
              <ButtonLink to={`/requests/${r.id}`} className="mt-4">
                {t("p2p.openRequest")}
              </ButtonLink>
            </li>
          ))}
        </ul>
        <ButtonLink to="/requests" variant="plain" className="mt-5">
          {t("requests.heading")}
        </ButtonLink>
      </PageShell>
    </main>
  );
}
