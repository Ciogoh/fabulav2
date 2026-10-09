/** Scheda privata condivisa: azioni del socio o revisione, senza duplicare il flusso. */
import { useLive } from "~/lib/use-live";
import { Form, useFetcher, useNavigation, useSearchParams } from "react-router";
import { PageShell, PageTitle } from "~/components/page";
import { Button, ButtonLink } from "~/components/button";
import { AssetFields } from "~/components/asset-fields";
import { PhotoFields } from "~/components/photo-picker";
import { PersonName } from "~/components/person";
import { Conversation } from "~/components/conversation";
import { useConfirm } from "~/components/confirm";
import { PROPOSAL_LABELS, canEditProposal } from "~/lib/marketplace";
import { useFormatDay, useT } from "~/i18n/use-t";
import type { proposalPage } from "~/lib/asset-proposals.server";
import type { TranslationKey } from "~/i18n/dictionaries";
export type ProposalPage = Awaited<ReturnType<typeof proposalPage>>;

export function ProposalDetail({
  data,
  error,
  values,
}: {
  data: ProposalPage;
  error?: TranslationKey;
  values?: { name: string; description: string; categoryId: string };
}) {
  const { asset, categories, moderator, loans } = data;
  useLive(`/api/stream?proposal=${asset.id}`);
  const t = useT();
  const format = useFormatDay();
  const [search] = useSearchParams();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const editable =
    !moderator && !asset.archivedAt && canEditProposal(asset.status);
  const reviewable =
    moderator && !asset.archivedAt && asset.status === "PENDING";
  const confirm = useConfirm();
  const back = moderator ? "/admin/proposals" : "/account/items";
  const version = asset.updatedAt.toISOString();
  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
        <ButtonLink to={back} variant="plain" className="mb-4 px-0">
          ← {t(moderator ? "p2p.proposals" : "p2p.myItems")}
        </ButtonLink>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PageTitle title={asset.name} />
          <ProposalBadge
            status={asset.status}
            archived={Boolean(asset.archivedAt)}
          />
        </div>
        {moderator && asset.owner && (
          <p className="mt-3 text-sm text-muted">
            {t("p2p.owner")}: <PersonName person={asset.owner} />
          </p>
        )}
        {moderator && asset.status === "APPROVED" && (
          <ButtonLink
            to={`/admin/assets/${asset.id}`}
            variant="quiet"
            className="mt-4"
          >
            {t("p2p.manageAsset")}
          </ButtonLink>
        )}
        {asset.submittedAt && (
          <p className="mt-2 text-sm text-muted">
            {t("p2p.submitted", {
              date: format(asset.submittedAt.toISOString().slice(0, 10)),
            })}
          </p>
        )}
        {search.get("notice") && (
          <p
            role="status"
            className="mt-5 rounded-sm border border-rule bg-card p-4 text-sm"
          >
            {t(
              search.get("notice") === "photo"
                ? "p2p.photoRecovery"
                : search.get("notice") === "submitted"
                  ? "p2p.submittedNotice"
                  : "p2p.draftNotice",
            )}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-sm bg-out-bg p-4 text-sm text-out"
          >
            {t(error)}
          </p>
        )}
        {asset.rejectionReason && (
          <section className="mt-5 rounded-sm border border-rule bg-card p-4">
            <h2 className="eyebrow">{t("p2p.statusRejected")}</h2>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">
              {asset.rejectionReason}
            </p>
          </section>
        )}

        {editable || reviewable ? (
          <Form
            key={version}
            method="post"
            encType="multipart/form-data"
            className="mt-7 flex flex-col gap-5"
          >
            <input type="hidden" name="version" value={version} />
            <AssetFields
              categories={categories}
              defaults={values ?? asset}
              isAdmin={false}
            />
            {editable ? (
              <PhotoFields existing={asset.photos} version={version} />
            ) : (
              <ProposalPhotos photos={asset.photos} name={asset.name} />
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                name="intent"
                value={reviewable ? "reviewSave" : "saveDraft"}
                type="submit"
                variant="secondary"
                busy={busy}
              >
                {t(reviewable ? "p2p.save" : "p2p.saveDraft")}
              </Button>
              {editable && (
                <Button
                  name="intent"
                  value="submit"
                  type="submit"
                  variant="primary"
                  busy={busy}
                >
                  {t("p2p.submit")}
                </Button>
              )}
            </div>
          </Form>
        ) : (
          <section className="mt-7">
            <ProposalPhotos photos={asset.photos} name={asset.name} />
            {asset.description && (
              <p className="mt-5 whitespace-pre-wrap break-words text-sm">
                {asset.description}
              </p>
            )}
          </section>
        )}

        {reviewable && (
          <section className="mt-7 rounded-sm border border-rule bg-card p-5">
            <h2 className="font-serif text-xl font-semibold">
              {t("p2p.review")}
            </h2>
            <Form
              method="post"
              className="mt-4"
              onSubmit={confirm.ask({
                title: t("p2p.approveConfirm"),
                confirmLabel: t("p2p.approve"),
                tone: "primary",
              })}
            >
              <input type="hidden" name="version" value={version} />
              <input type="hidden" name="intent" value="approve" />
              <Button type="submit" variant="primary" busy={busy}>
                {t("p2p.approve")}
              </Button>
            </Form>
            <Form method="post" className="mt-5 flex flex-col gap-2">
              <input type="hidden" name="version" value={version} />
              <input type="hidden" name="intent" value="reject" />
              <label htmlFor="reason" className="eyebrow">
                {t("p2p.reason")}
              </label>
              <textarea
                id="reason"
                name="reason"
                rows={3}
                maxLength={2000}
                required
                className="field"
                aria-describedby="reason-hint"
              />
              <p id="reason-hint" className="text-xs text-muted">
                {t("p2p.reasonHint")}
              </p>
              <Button
                type="submit"
                variant="danger"
                className="self-start"
                busy={busy}
              >
                {t("p2p.reject")}
              </Button>
            </Form>
          </section>
        )}

        {!moderator && !asset.archivedAt && (
          <div className="mt-7 flex flex-col gap-4">
            {asset.status === "APPROVED" && (
              <>
                <ButtonLink
                  to={`/items/${asset.id}`}
                  variant="quiet"
                  className="self-start"
                >
                  {t("p2p.open")}
                </ButtonLink>
                <PauseSwitch version={version} enabled={asset.isBookable} />
              </>
            )}
            {(asset.status === "PENDING" || asset.status === "APPROVED") && (
              <Form
                method="post"
                onSubmit={confirm.ask({
                  title: t("p2p.withdrawConfirm"),
                  confirmLabel: t("p2p.withdraw"),
                })}
              >
                <input type="hidden" name="version" value={version} />
                <input type="hidden" name="intent" value="withdraw" />
                <Button type="submit" disabled={loans.length > 0} busy={busy}>
                  {t(
                    asset.status === "APPROVED"
                      ? "p2p.editPublished"
                      : "p2p.withdraw",
                  )}
                </Button>
              </Form>
            )}
            <Form
              method="post"
              onSubmit={confirm.ask({
                title: t(
                  asset.status === "APPROVED"
                    ? "p2p.archiveConfirm"
                    : "p2p.deleteConfirm",
                ),
                confirmLabel: t(
                  asset.status === "APPROVED" ? "p2p.archive" : "p2p.delete",
                ),
                tone: "danger",
              })}
            >
              <input type="hidden" name="version" value={version} />
              <input
                type="hidden"
                name="intent"
                value={asset.status === "APPROVED" ? "archive" : "delete"}
              />
              <Button
                type="submit"
                variant="danger"
                disabled={loans.length > 0}
                busy={busy}
              >
                {t(asset.status === "APPROVED" ? "p2p.archive" : "p2p.delete")}
              </Button>
            </Form>
          </div>
        )}
        {loans.length > 0 && (
          <section className="mt-7 border-t border-rule pt-5">
            <h2 className="eyebrow">{t("p2p.activeLoans")}</h2>
            <p className="mt-2 text-sm text-muted">{t("p2p.errorActive")}</p>
            <ul className="mt-3 flex flex-col gap-2">
              {loans.map((loan) => (
                <li key={loan.id}>
                  <ButtonLink variant="plain" to={`/requests/${loan.id}`}>
                    {format(loan.startDate.toISOString().slice(0, 10))} —{" "}
                    {format(loan.endDate.toISOString().slice(0, 10))}
                  </ButtonLink>
                </li>
              ))}
            </ul>
          </section>
        )}
        <Conversation id={asset.id} messages={asset.messages} review />
        {confirm.dialog}
      </PageShell>
    </main>
  );
}

export function ProposalBadge({
  status,
  archived = false,
}: {
  status: keyof typeof PROPOSAL_LABELS;
  archived?: boolean;
}) {
  const t = useT();
  return (
    <span
      className={`rounded-full px-3 py-1.5 font-mono text-xs ${status === "REJECTED" && !archived ? "bg-out-bg text-out" : "bg-sunk text-muted"}`}
    >
      {t(archived ? "p2p.archived" : PROPOSAL_LABELS[status])}
    </span>
  );
}
function ProposalPhotos({
  photos,
  name,
}: {
  photos: ProposalPage["asset"]["photos"];
  name: string;
}) {
  const t = useT();
  return (
    <div className="grid grid-cols-2 gap-3">
      {photos.map((p) => (
        <a
          key={p.id}
          href={p.url}
          target="_blank"
          rel="noreferrer"
          className="overflow-hidden rounded-sm border border-rule"
        >
          <img
            src={p.url}
            alt={t("item.photoAlt", { name })}
            className="aspect-4/3 w-full object-cover"
            loading="lazy"
          />
        </a>
      ))}
    </div>
  );
}
function PauseSwitch({
  version,
  enabled,
}: {
  version: string;
  enabled: boolean;
}) {
  const t = useT();
  const fetcher = useFetcher<{ ok: boolean; error?: TranslationKey }>();
  return (
    <div className="rounded-sm border border-rule bg-card p-4">
      <fetcher.Form method="post">
        <input type="hidden" name="version" value={version} />
        <input type="hidden" name="intent" value="pause" />
        <div className="flex items-center justify-between gap-4">
          <div>
            <p id="pause-label" className="text-sm font-medium">
              {t("p2p.pause")}
            </p>
            <p id="pause-hint" className="mt-1 text-xs text-muted">
              {t("p2p.pauseHint")}
            </p>
          </div>
          <button
            type="submit"
            role="switch"
            aria-checked={enabled}
            aria-labelledby="pause-label"
            aria-describedby="pause-hint"
            aria-busy={fetcher.state !== "idle"}
            disabled={fetcher.state !== "idle"}
            className="flex min-h-11 min-w-14 shrink-0 items-center justify-center"
          >
            <span
              className={`flex h-6 w-11 items-center rounded-full border px-0.5 ${enabled ? "border-accent bg-accent" : "border-rule bg-sunk"}`}
            >
              <span
                className={`h-4 w-4 rounded-full ${enabled ? "ml-auto bg-on-accent" : "bg-muted"}`}
              />
            </span>
          </button>
        </div>
      </fetcher.Form>
      {fetcher.data?.error && (
        <p role="alert" className="mt-2 text-sm text-out">
          {t(fetcher.data.error)}
        </p>
      )}
    </div>
  );
}
