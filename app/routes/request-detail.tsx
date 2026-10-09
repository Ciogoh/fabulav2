/**
 * Il dettaglio di una richiesta.
 *
 * Due pubblici sullo stesso URL: chi l'ha fatta vede stato, oggetti e la
 * chat, e può modificare le date o annullare; un admin vede in più chi è
 * (nome ed email), una nota interna, approva/rifiuta/annulla, segna
 * ritiro e riconsegna per singolo oggetto, e manda un promemoria.
 *
 * La chat (`Message`) è aperta a entrambi — è lì che ci si mette d'accordo
 * su un ritiro, non solo un canale per l'admin.
 */

import { useEffect, useState } from "react";
import { Conversation } from "~/components/conversation";
import { requestCapabilities } from "~/lib/marketplace";
import { mutateRequest, RequestMutationError } from "~/lib/request-mutations.server";
import { useFetcher } from "react-router";
import type { Route } from "./+types/request-detail";
import { PageShell } from "~/components/page";
import { Button, buttonClass } from "~/components/button";
import { useConfirm } from "~/components/confirm";
import { pageTitle } from "~/i18n/meta";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";
import {
  formatDay,
  todayUtc,
} from "~/lib/availability.server";
import { REQUEST_STATUS_LABELS } from "~/lib/request-status";
import { useFormatDay, useT } from "~/i18n/use-t";
import type { TranslationKey } from "~/i18n/dictionaries";
import type { RequestStatus } from "~/generated/prisma/enums";
import { PersonName } from "~/components/person";
import { type Person } from "~/lib/person";
import { DateRangeFields, daysBetweenInclusive } from "~/components/date-range-fields";
import { useLive } from "~/lib/use-live";
import { MAX_ORDINARY_SPAN_DAYS as ORDINARY_SPAN } from "~/lib/availability.shared";

export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "requests.detailHeading") }];
}

async function loadAuthorized(userId: string, isAdminRole: boolean, id: string) {
  const req = await db.request.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      lenderId: true,
      lenderSeenAt: true,
      lender: { select: { name: true, firstName: true, lastName: true, alias: true } },
      startDate: true,
      endDate: true,
      status: true,
      purpose: true,
      adminNote: true,
      adminSeenAt: true,
      userSeenAt: true,
      // Campo per campo, e con quelli del profilo: chi decide su una
      // richiesta deve vedere l'alias *e* il nome vero.
      user: {
        select: {
          // Serve agli avvisi: un avviso appartiene a una persona — è la
          // chiave con cui `deliver` trova il canale scelto e i dispositivi
          // iscritti — e non a una casella di posta.
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          alias: true,
          email: true,
        },
      },
      items: {
        select: {
          id: true,
          assetId: true,
          pickedUpAt: true,
          returnedAt: true,
          // `location` serve al promemoria a mano, che dice **dove**
          // riportare. Non esce da qui verso il browser: il loader più
          // sotto sceglie campo per campo e non la include.
          asset: { select: { name: true, location: true, archivedAt: true } },
          fromKit: { select: { name: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              alias: true,
              image: true,
              role: true,
            },
          },
        },
      },
    },
  });

  if (!req) throw new Response("Not found", { status: 404 });

  const isOwner = req.userId === userId;
  if (!isAdminRole && !isOwner && req.lenderId !== userId) throw new Response("Not found", { status: 404 });

  return req;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const isAdmin = user.role === "ADMIN";
  const req = await loadAuthorized(user.id, isAdmin, params.id);

  const caps = requestCapabilities(user, req);
  const last = req.messages.at(-1);
  const seen = req[caps.seen];
  if (last && (!seen || last.createdAt > seen)) await db.request.updateMany({ where: { id: req.id, [caps.seen]: req[caps.seen] }, data: { [caps.seen]: last.createdAt } });

  return {
    id: req.id,
    startDate: formatDay(req.startDate),
    endDate: formatDay(req.endDate),
    status: req.status,
    purpose: req.purpose,
    today: formatDay(todayUtc()),
    isOwner: caps.borrower,
    canManage: caps.manage,
    canEdit: caps.edit,
    lender: req.lender,
    borrower: { name: req.user.name, firstName: req.user.firstName, lastName: req.user.lastName, alias: req.user.alias },
    intervention: isAdmin && req.lenderId !== null && !caps.borrower && !caps.lender,
    items: req.items.map((item) => ({
      id: item.id,
      name: item.asset.name,
      fromKitName: item.fromKit?.name ?? null,
      pickedUp: item.pickedUpAt !== null,
      returned: item.returnedAt !== null,
      archived: item.asset.archivedAt !== null,
    })),
    messages: req.messages.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      author: {
        name: m.author.name,
        firstName: m.author.firstName,
        lastName: m.author.lastName,
        alias: m.author.alias,
        image: m.author.image,
      },
      authorIsAdmin: m.author.role === "ADMIN",
      isMine: m.author.id === user.id,
    })),
    currentUserId: user.id,
    admin: isAdmin
      ? {
          note: req.adminNote,
          holder: {
            name: req.user.name,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
            alias: req.user.alias,
          },
          holderEmail: req.user.email,
        }
      : null,
  };
}

/** L'action delega al servizio che controlla ogni intento dentro la transazione. */
export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request);
  try { return await mutateRequest(user, params.id, await request.formData(), new URL(request.url).origin); }
  catch (error) {
    if (error instanceof RequestMutationError) return { ok: false as const, error: error.key, conflicts: error.conflicts };
    throw error;
  }
}

export default function RequestDetail({ loaderData }: Route.ComponentProps) {
  const { id, startDate, endDate, status, purpose, today, isOwner, canManage, canEdit, lender, borrower, intervention, items, messages, admin } =
    loaderData;
  const t = useT();
  const formatDayLabel = useFormatDay();

  /* La chat si aggiorna da sola: è qui che ci si accorda su un ritiro, e una
     pagina che mostra la conversazione di dieci minuti fa è peggio che non
     mostrarla — chi la guarda crede di essere aggiornato. Vale anche per le
     decisioni: chi ha chiesto vede l'approvazione senza ricaricare. */
  useLive(`/api/stream?request=${id}`);

  const anyPickedUp = items.some((item) => item.pickedUp);
  const canEditOrCancel = (canEdit || canManage) && !anyPickedUp && (status === "PENDING" || status === "APPROVED");

  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-serif text-2xl font-semibold tracking-tight">
            {formatDayLabel(startDate)} — {formatDayLabel(endDate)}
          </h1>
          <span className="rounded-full bg-sunk px-2.5 py-1 font-mono text-2xs font-medium uppercase tracking-wider text-muted">
            {t(REQUEST_STATUS_LABELS[status])}
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-1 text-sm text-muted"><p>{t("p2p.lender")}: {lender ? <PersonName person={lender} /> : "Material Matters"}</p>{canManage && <p>{t("p2p.borrower")}: <PersonName person={borrower} /></p>}</div>
        {intervention && <p className="mt-3 rounded-sm border border-rule bg-card p-3 text-sm">{t("p2p.adminIntervention")}</p>}
        {status === "PENDING" && isOwner && <p className="mt-3 text-sm text-muted">{t("p2p.notReserved")}</p>}
        {purpose && <p className="mt-2 text-sm text-muted">{purpose}</p>}

        {canEditOrCancel && (
          <RequestActions
            id={id}
            today={today}
            startDate={startDate}
            endDate={endDate}
            purpose={purpose}
            canCancel={!anyPickedUp}
            canEdit={canEdit}
          />
        )}

        <ul className="mt-6 flex flex-col gap-1.5 border-t border-rule pt-4 text-sm">
          {items.map((item) => (
            <ItemRow key={item.id} id={id} item={item} isAdmin={canManage} compact={Boolean(admin)} status={status} />
          ))}
        </ul>

        {(admin || canManage) && <AdminSection id={id} status={status} admin={admin} canManage={canManage} />}

        <Conversation id={id} messages={messages} />
      </PageShell>
    </main>
  );
}

/* ---------------------------------------------------- date e annulla */

function RequestActions({
  id,
  today,
  startDate,
  endDate,
  purpose: initialPurpose,
  canCancel,
  canEdit,
}: {
  id: string;
  today: string;
  startDate: string;
  endDate: string;
  purpose: string | null;
  canCancel: boolean;
  canEdit: boolean;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const editFetcher = useFetcher<typeof action>();
  const cancelFetcher = useFetcher<typeof action>();

  const [from, setFrom] = useState(startDate);
  const [to, setTo] = useState(endDate);
  /* Due difetti che si sommavano, e si vedevano solo aprendo «Modifica date»
     su una richiesta che ne aveva già: il campo partiva **vuoto**, quindi
     salvare cancellava in silenzio quello che era stato scritto; e la spunta
     partiva **spenta**, quindi una richiesta speciale già approvata veniva
     rifiutata con `errorSpan` senza che nessuno avesse toccato le date. */
  const [longer, setLonger] = useState(
    daysBetweenInclusive(startDate, endDate) > ORDINARY_SPAN
  );
  const [purpose, setPurpose] = useState(initialPurpose ?? "");
  const confirm = useConfirm();

  useEffect(() => {
    if (editFetcher.state === "idle" && editFetcher.data?.ok) {
      setEditing(false);
    }
  }, [editFetcher.state, editFetcher.data]);

  const editResult = editFetcher.data && !editFetcher.data.ok ? editFetcher.data : null;

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {canEdit && <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          className={buttonClass("quiet", "sm")}
        >
          {t("request.editDates")}
        </button>}

        {canCancel && (
          <cancelFetcher.Form
            method="post"
            onSubmit={confirm.ask({
              title: t("request.confirmCancel"),
              confirmLabel: t("request.cancelRequest"),
            })}
          >
            <input type="hidden" name="intent" value="cancel" />
            <button
              type="submit"
              disabled={cancelFetcher.state !== "idle"}
              className={buttonClass("danger", "sm")}
            >
              {t("request.cancelRequest")}
            </button>
          </cancelFetcher.Form>
        )}
      </div>

      {cancelFetcher.data && !cancelFetcher.data.ok && (
        <p className="text-sm text-out">{t(cancelFetcher.data.error)}</p>
      )}

      {confirm.dialog}

      {editing && (
        <editFetcher.Form
          method="post"
          id={`edit-dates-${id}`}
          className="flex flex-col gap-4 rounded-sm border border-rule bg-card p-4"
        >
          <input type="hidden" name="intent" value="editDates" />
          <DateRangeFields
            today={today}
            from={from}
            to={to}
            longer={longer}
            purpose={purpose}
            onFromChange={setFrom}
            onToChange={setTo}
            onLongerChange={setLonger}
            onPurposeChange={setPurpose}
          />

          {editResult && (
            <p role="alert" className="rounded-sm bg-out-bg px-3 py-2 text-sm text-out">
              {t(editResult.error)}
              {editResult.conflicts && editResult.conflicts.length > 0 && (
                <> — {editResult.conflicts.join(", ")}</>
              )}
            </p>
          )}

          <div className="flex items-center justify-end gap-3">
            <Button variant="plain" onClick={() => setEditing(false)}>
              {t("request.cancel")}
            </Button>
            <button
              type="submit"
              disabled={editFetcher.state !== "idle"}
              className={buttonClass("primary")}
            >
              {t("request.submit")}
            </button>
          </div>
        </editFetcher.Form>
      )}
    </div>
  );
}

/* --------------------------------------------------------- oggetti */

type Item = {
  id: string;
  name: string;
  fromKitName: string | null;
  pickedUp: boolean;
  returned: boolean;
  archived: boolean;
};

function ItemRow({
  id,
  item,
  compact,
  isAdmin,
  status,
}: {
  id: string;
  item: Item;
  compact: boolean;
  isAdmin: boolean;
  status: RequestStatus;
}) {
  const t = useT();
  const fetcher = useFetcher<typeof action>();
  const showHandoverActions = isAdmin && status === "APPROVED" && !item.archived;

  return (
    <li className="flex flex-wrap items-center justify-between gap-2">
      <span className="min-w-0 max-w-full break-words">
        {item.name}
        {item.fromKitName && (
          <span className="ml-2 font-mono text-2xs uppercase tracking-wider text-muted">
            {item.fromKitName}
          </span>
        )}
      </span>

      <span className="flex items-center gap-2">
        {item.archived ? (<span className="font-mono text-2xs uppercase tracking-wider text-muted">{t("p2p.archived")}</span>) : item.returned ? (
          <span className="font-mono text-2xs uppercase tracking-wider text-muted">
            {t("requests.item.returned")}
          </span>
        ) : item.pickedUp ? (
          <span className="font-mono text-2xs uppercase tracking-wider text-held">
            {t("requests.item.pickedUp")}
          </span>
        ) : null}

        {showHandoverActions && !item.pickedUp && (
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="pickup" />
            <input type="hidden" name="itemId" value={item.id} />
            <button
              type="submit"
              disabled={fetcher.state !== "idle"}
              className={buttonClass("quiet", compact ? "sm" : "md", "font-mono text-2xs uppercase tracking-wider")}
            >
              {t("requests.admin.markPickedUp")}
            </button>
          </fetcher.Form>
        )}
        {showHandoverActions && item.pickedUp && !item.returned && (
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="return" />
            <input type="hidden" name="itemId" value={item.id} />
            <button
              type="submit"
              disabled={fetcher.state !== "idle"}
              className={buttonClass("quiet", compact ? "sm" : "md", "font-mono text-2xs uppercase tracking-wider")}
            >
              {t("requests.admin.markReturned")}
            </button>
          </fetcher.Form>
        )}
      </span>
      {fetcher.data && "error" in fetcher.data && <p role="alert" className="w-full text-sm text-out">{t(fetcher.data.error)}{fetcher.data.conflicts?.length ? ` — ${fetcher.data.conflicts.join(", ")}` : ""}</p>}
    </li>
  );
}

/* -------------------------------------------------------------- admin */

function AdminSection({
  id,
  status,
  admin,
  canManage,
}: {
  id: string;
  status: RequestStatus;
  admin: { note: string | null; holder: Person; holderEmail: string } | null;
  canManage: boolean;
}) {
  const t = useT();
  const noteFetcher = useFetcher<typeof action>();
  const decisionFetcher = useFetcher<typeof action>();
  const reminderFetcher = useFetcher<typeof action>();

  return (
    <section className="mt-8 rounded-sm border border-rule bg-card p-4">
      <span className="eyebrow">
        {t(admin ? "requests.admin.heading" : "p2p.lending")}
      </span>

      {admin && <p className="mt-2 text-sm">
        {t("requests.admin.requestedBy")}{" "}
        <PersonName person={admin.holder} className="font-medium" />{" "}
        <span className="text-muted">({admin.holderEmail})</span>
      </p>}

      {canManage && status === "PENDING" && (
        <div className="mt-4 flex gap-2">
          <decisionFetcher.Form method="post">
            <input type="hidden" name="intent" value="approve" />
            <Button
              type="submit"
              variant="primary"
              size={admin ? "sm" : "md"}
              busy={decisionFetcher.state !== "idle"}
            >
              {t("requests.admin.approve")}
            </Button>
          </decisionFetcher.Form>
          <decisionFetcher.Form method="post">
            <input type="hidden" name="intent" value="reject" />
            <Button
              type="submit"
              variant="danger"
              size={admin ? "sm" : "md"}
              busy={decisionFetcher.state !== "idle"}
            >
              {t("requests.admin.reject")}
            </Button>
          </decisionFetcher.Form>
        </div>
      )}
      {decisionFetcher.data && !decisionFetcher.data.ok && (
        <p className="mt-2 text-sm text-out">{t(decisionFetcher.data.error)}</p>
      )}

      {canManage && status === "APPROVED" && (
        <reminderFetcher.Form method="post" className="mt-4">
          <input type="hidden" name="intent" value="reminder" />
          <button
            type="submit"
            disabled={reminderFetcher.state !== "idle"}
            className={buttonClass("secondary", "sm")}
          >
            {t("requests.admin.sendReminder")}
          </button>
          {reminderFetcher.state === "idle" && reminderFetcher.data?.ok && (
            <span className="ml-3 text-sm text-muted">
              {t("requests.admin.reminderSent")}
            </span>
          )}
          {reminderFetcher.data && !reminderFetcher.data.ok && (
            <p className="mt-2 text-sm text-out">{t(reminderFetcher.data.error)}</p>
          )}
        </reminderFetcher.Form>
      )}

      {admin && <noteFetcher.Form method="post" className="mt-5 flex flex-col gap-2">
        <input type="hidden" name="intent" value="note" />
        <label
          htmlFor={`note-${id}`}
          className="eyebrow"
        >
          {t("requests.admin.note")}
        </label>
        <textarea
          id={`note-${id}`}
          name="note"
          rows={3}
          defaultValue={admin.note ?? ""}
          className="field-area"
        />
        <button
          type="submit"
          disabled={noteFetcher.state !== "idle"}
          className={buttonClass("quiet", admin ? "sm" : "md", "self-start")}
        >
          {t("requests.admin.saveNote")}
        </button>
      </noteFetcher.Form>}
    </section>
  );
}
