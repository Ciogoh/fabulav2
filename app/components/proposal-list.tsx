/** Elenco leggibile anche su telefono, con prossimo passo e stati testuali. */
import { Form, Link, useSubmit } from "react-router";
import { PageShell, PageTitle } from "~/components/page";
import { Button, ButtonLink } from "~/components/button";
import { Select } from "~/components/select";
import { ProposalBadge } from "~/components/proposal-detail";
import { PersonName } from "~/components/person";
import { PROPOSAL_LABELS } from "~/lib/marketplace";
import { initialsOf } from "~/lib/initials";
import { useFormatDay, useT } from "~/i18n/use-t";
import { useLive } from "~/lib/use-live";
import type { proposalList } from "~/lib/proposal-list.server";
export function ProposalList({
  data,
}: {
  data: Awaited<ReturnType<typeof proposalList>>;
}) {
  const t = useT();
  const format = useFormatDay();
  const submit = useSubmit();
  const { moderator, assets, status, query } = data;
  useLive(moderator ? "/api/stream" : "/api/stream?lending=1");
  return (
    <main>
      <PageShell className="pb-24 pt-8">
        <PageTitle
          title={t(moderator ? "p2p.proposals" : "p2p.myItems")}
          actions={
            !moderator && (
              <ButtonLink variant="primary" to="/presta">
                {t("p2p.heading")}
              </ButtonLink>
            )
          }
        />
        {!moderator && (
          <ButtonLink
            to="/account/lending"
            variant="plain"
            className="mt-2 px-0"
          >
            {t("p2p.lending")} →
          </ButtonLink>
        )}
        <Form method="get" className="mt-6 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="status" className="eyebrow">
              {t("p2p.publication")}
            </label>
            <Select
              name="status"
              id="status"
              value={status}
              onChange={(e) => submit(e.currentTarget.form)}
            >
              <option value="all">{t("p2p.all")}</option>
              {Object.entries(PROPOSAL_LABELS).map(([value, key]) => (
                <option key={value} value={value}>
                  {t(key)}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex min-w-40 flex-1 flex-col gap-1.5 sm:max-w-sm">
            <label htmlFor="q" className="eyebrow">
              {t(moderator ? "p2p.searchProposals" : "p2p.search")}
            </label>
            <input
              key={query}
              type="search"
              id="q"
              name="q"
              defaultValue={query}
              className="field"
            />
          </div>
          <Button type="submit">{t("catalogue.search")}</Button>
        </Form>
        {assets.length ? (
          <ul className="mt-7 grid gap-3 lg:grid-cols-2">
            {assets.map((a) => (
              <li key={a.id}>
                <Link
                  to={`${moderator ? "/admin/proposals" : "/account/items"}/${a.id}`}
                  className="flex h-full items-start gap-4 rounded-sm border border-rule bg-card p-4 hover:border-accent"
                >
                  {a.photos[0] ? (
                    <img
                      src={a.photos[0].thumbUrl}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded-sm object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex h-20 w-20 shrink-0 items-center justify-center rounded-sm bg-sunk font-serif text-2xl text-faint"
                    >
                      {initialsOf(a.name)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words text-lg font-semibold">
                      {a.name}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <ProposalBadge
                        status={a.status}
                        archived={Boolean(a.archivedAt)}
                      />
                      {a.status === "APPROVED" && !a.isBookable && (
                        <span className="py-1.5 text-xs text-muted">
                          {t("p2p.paused")}
                        </span>
                      )}
                    </div>
                    {moderator && a.owner && (
                      <p className="mt-2 text-sm text-muted">
                        <PersonName person={a.owner} />
                      </p>
                    )}
                    {a.submittedAt && (
                      <p className="mt-2 text-xs text-muted">
                        {t("p2p.submitted", {
                          date: format(
                            a.submittedAt.toISOString().slice(0, 10),
                          ),
                        })}
                      </p>
                    )}
                    {a.unread && (
                      <p className="mt-2 font-medium text-accent">
                        {t("p2p.unread")}
                      </p>
                    )}
                  </div>
                  <span aria-hidden="true" className="text-muted">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-8 rounded-sm border border-dashed border-rule p-8">
            <p className="text-muted">
              {t(moderator ? "p2p.emptyProposals" : "p2p.emptyItems")}
            </p>
            {!moderator && (
              <ButtonLink to="/presta" variant="primary" className="mt-4">
                {t("p2p.heading")}
              </ButtonLink>
            )}
          </div>
        )}
      </PageShell>
    </main>
  );
}
