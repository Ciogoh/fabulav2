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

import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import type { Route } from "./+types/request-detail";
import { db } from "~/lib/db.server";
import { requireAdmin, requireUser } from "~/lib/session.server";
import {
  formatDay,
  getBusyAssetIds,
  MAX_ORDINARY_SPAN_DAYS,
  MAX_SPECIAL_SPAN_DAYS,
  parseDay,
  todayUtc,
} from "~/lib/availability.server";
import { notifyRequesterCancelled, notifyRequesterDecision, sendReturnReminder } from "~/lib/notifications.server";
import { useFormatDay, useLang, useT } from "~/i18n/use-t";
import type { TranslationKey } from "~/i18n/dictionaries";
import type { RequestStatus } from "~/generated/prisma/enums";
import { AdminBadge } from "~/components/admin-badge";
import { DateRangeFields } from "~/components/date-range-fields";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Fabula" }];
}

async function loadAuthorized(userId: string, isAdminRole: boolean, id: string) {
  const req = await db.request.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      startDate: true,
      endDate: true,
      status: true,
      purpose: true,
      adminNote: true,
      user: { select: { name: true, email: true } },
      items: {
        select: {
          id: true,
          assetId: true,
          pickedUpAt: true,
          returnedAt: true,
          asset: { select: { name: true } },
          fromKit: { select: { name: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { id: true, name: true, role: true } },
        },
      },
    },
  });

  if (!req) throw new Response("Not found", { status: 404 });

  const isOwner = req.userId === userId;
  if (!isAdminRole && !isOwner) throw new Response("Not found", { status: 404 });

  return req;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const isAdmin = user.role === "ADMIN";
  const req = await loadAuthorized(user.id, isAdmin, params.id);

  return {
    id: req.id,
    startDate: formatDay(req.startDate),
    endDate: formatDay(req.endDate),
    status: req.status,
    purpose: req.purpose,
    today: formatDay(todayUtc()),
    isOwner: req.userId === user.id,
    items: req.items.map((item) => ({
      id: item.id,
      name: item.asset.name,
      fromKitName: item.fromKit?.name ?? null,
      pickedUp: item.pickedUpAt !== null,
      returned: item.returnedAt !== null,
    })),
    messages: req.messages.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      authorName: m.author.name,
      authorIsAdmin: m.author.role === "ADMIN",
      isMine: m.author.id === user.id,
    })),
    currentUserId: user.id,
    admin: isAdmin
      ? {
          note: req.adminNote,
          holderName: req.user.name,
          holderEmail: req.user.email,
        }
      : null,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request);
  const isAdmin = user.role === "ADMIN";
  const req = await loadAuthorized(user.id, isAdmin, params.id);
  const isOwner = req.userId === user.id;

  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  if (intent === "message") {
    const body = String(form.get("body") ?? "").trim();
    if (!body) {
      return { ok: false as const, error: "request.errorMessageEmpty" as TranslationKey };
    }
    await db.message.create({
      data: { requestId: req.id, authorId: user.id, body: body.slice(0, 2000) },
    });
    return { ok: true as const, intent };
  }

  // editDates e cancel: chi ha fatto la richiesta o un admin — stessa
  // guardia già usata per "message", `loadAuthorized` ha già verificato che
  // solo questi due possano essere arrivati fin qui.
  if (intent === "editDates") {
    if (req.status !== "PENDING" && req.status !== "APPROVED") {
      return { ok: false as const, error: "request.errorNotPendingOrApproved" as TranslationKey };
    }

    const from = parseDay(String(form.get("from") ?? ""));
    const to = parseDay(String(form.get("to") ?? ""));
    const longer = form.get("longer") === "1";
    const purpose = String(form.get("purpose") ?? "").trim();
    const today = todayUtc();

    if (!from || !to || from < today || to < from) {
      return { ok: false as const, error: "request.errorDates" as TranslationKey };
    }
    const spanDays = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
    if (!longer && spanDays > MAX_ORDINARY_SPAN_DAYS) {
      return { ok: false as const, error: "request.errorSpan" as TranslationKey };
    }
    if (longer && purpose.length === 0) {
      return { ok: false as const, error: "request.errorPurposeRequired" as TranslationKey };
    }
    if (spanDays > MAX_SPECIAL_SPAN_DAYS) {
      return { ok: false as const, error: "request.errorSpan" as TranslationKey };
    }

    const busy = await getBusyAssetIds(from, to, { excludeRequestId: req.id });
    const conflicts = req.items
      .filter((item) => busy.has(item.assetId))
      .map((item) => item.asset.name);
    if (conflicts.length > 0) {
      return { ok: false as const, error: "request.errorConflict" as TranslationKey, conflicts };
    }

    // Date nuove sono di fatto una richiesta nuova: se era già approvata,
    // torna in attesa — l'approvazione manuale non ha scorciatoie.
    await db.request.update({
      where: { id: req.id },
      data: {
        startDate: from,
        endDate: to,
        purpose: purpose || null,
        status: "PENDING",
        decidedAt: null,
        decidedById: null,
      },
    });
    return { ok: true as const, intent };
  }

  if (intent === "cancel") {
    if (req.status === "CANCELLED" || req.status === "REJECTED") {
      return { ok: false as const, error: "request.errorGeneric" as TranslationKey };
    }
    if (req.items.some((item) => item.pickedUpAt !== null)) {
      return { ok: false as const, error: "request.errorAlreadyPickedUp" as TranslationKey };
    }

    await db.request.update({ where: { id: req.id }, data: { status: "CANCELLED" } });

    if (isAdmin && !isOwner) {
      try {
        await notifyRequesterCancelled({
          to: req.user.email,
          name: req.user.name,
          itemNames: req.items.map((item) => item.asset.name),
          startDate: req.startDate,
          endDate: req.endDate,
          requestId: req.id,
          origin: new URL(request.url).origin,
        });
      } catch (error) {
        console.error("Notifica di annullamento fallita:", error);
      }
    }
    return { ok: true as const, intent };
  }

  // Tutto il resto è riservato agli admin. `requireAdmin` protegge anche chi
  // arrivasse qui direttamente con `curl` bypassando l'interfaccia.
  const admin = await requireAdmin(request);

  if (intent === "note") {
    const note = String(form.get("note") ?? "").trim();
    await db.request.update({
      where: { id: req.id },
      data: { adminNote: note || null },
    });
    return { ok: true as const, intent };
  }

  if (intent === "approve" || intent === "reject") {
    if (req.status !== "PENDING") {
      return { ok: false as const, error: "request.errorNotPending" as TranslationKey };
    }
    await db.request.update({
      where: { id: req.id },
      data: {
        status: intent === "approve" ? "APPROVED" : "REJECTED",
        decidedAt: new Date(),
        decidedById: admin.id,
      },
    });
    try {
      await notifyRequesterDecision({
        to: req.user.email,
        name: req.user.name,
        itemNames: req.items.map((item) => item.asset.name),
        startDate: req.startDate,
        endDate: req.endDate,
        decision: intent === "approve" ? "approved" : "rejected",
        requestId: req.id,
        origin: new URL(request.url).origin,
      });
    } catch (error) {
      console.error("Notifica di decisione fallita:", error);
    }
    return { ok: true as const, intent };
  }

  if (intent === "pickup" || intent === "return") {
    if (req.status !== "APPROVED") {
      return { ok: false as const, error: "request.errorGeneric" as TranslationKey };
    }
    const itemId = String(form.get("itemId") ?? "");
    const item = req.items.find((i) => i.id === itemId);
    if (!item) {
      return { ok: false as const, error: "request.errorGeneric" as TranslationKey };
    }

    if (intent === "pickup") {
      if (item.pickedUpAt) {
        return { ok: false as const, error: "request.errorGeneric" as TranslationKey };
      }
      await db.requestItem.update({ where: { id: itemId }, data: { pickedUpAt: new Date() } });
    } else {
      if (!item.pickedUpAt || item.returnedAt) {
        return { ok: false as const, error: "request.errorGeneric" as TranslationKey };
      }
      await db.requestItem.update({ where: { id: itemId }, data: { returnedAt: new Date() } });
    }
    return { ok: true as const, intent };
  }

  if (intent === "reminder") {
    try {
      await sendReturnReminder({
        to: req.user.email,
        name: req.user.name,
        itemNames: req.items.map((item) => item.asset.name),
        endDate: req.endDate,
      });
    } catch (error) {
      console.error("Invio promemoria fallito:", error);
      return { ok: false as const, error: "request.errorReminderFailed" as TranslationKey };
    }
    return { ok: true as const, intent };
  }

  return { ok: false as const, error: "request.errorGeneric" as TranslationKey };
}

const STATUS_LABELS: Record<RequestStatus, TranslationKey> = {
  PENDING: "requests.status.pending",
  APPROVED: "requests.status.approved",
  REJECTED: "requests.status.rejected",
  CANCELLED: "requests.status.cancelled",
};

export default function RequestDetail({ loaderData }: Route.ComponentProps) {
  const { id, startDate, endDate, status, purpose, today, isOwner, items, messages, admin } =
    loaderData;
  const t = useT();
  const formatDayLabel = useFormatDay();

  const canManage = isOwner || Boolean(admin);
  const canEditOrCancel = canManage && (status === "PENDING" || status === "APPROVED");
  const anyPickedUp = items.some((item) => item.pickedUp);

  return (
    <main className="mx-auto w-full max-w-2xl px-6 pb-24 pt-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">
          {formatDayLabel(startDate)} — {formatDayLabel(endDate)}
        </h1>
        <span className="rounded-full bg-sunk px-2.5 py-1 font-mono text-[0.68rem] font-medium uppercase tracking-wider text-muted">
          {t(STATUS_LABELS[status])}
        </span>
      </div>

      {purpose && <p className="mt-2 text-sm text-muted">{purpose}</p>}

      {canEditOrCancel && (
        <RequestActions
          id={id}
          today={today}
          startDate={startDate}
          endDate={endDate}
          canCancel={!anyPickedUp}
        />
      )}

      <ul className="mt-6 flex flex-col gap-1.5 border-t border-rule pt-4 text-sm">
        {items.map((item) => (
          <ItemRow key={item.id} id={id} item={item} isAdmin={Boolean(admin)} status={status} />
        ))}
      </ul>

      {admin && <AdminSection id={id} status={status} admin={admin} />}

      <ChatSection id={id} messages={messages} />
    </main>
  );
}

/* ---------------------------------------------------- date e annulla */

function RequestActions({
  id,
  today,
  startDate,
  endDate,
  canCancel,
}: {
  id: string;
  today: string;
  startDate: string;
  endDate: string;
  canCancel: boolean;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const editFetcher = useFetcher<typeof action>();
  const cancelFetcher = useFetcher<typeof action>();

  const [from, setFrom] = useState(startDate);
  const [to, setTo] = useState(endDate);
  const [longer, setLonger] = useState(false);
  const [purpose, setPurpose] = useState("");

  useEffect(() => {
    if (editFetcher.state === "idle" && editFetcher.data?.ok) {
      setEditing(false);
    }
  }, [editFetcher.state, editFetcher.data]);

  const editResult = editFetcher.data && !editFetcher.data.ok ? editFetcher.data : null;

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          className="rounded border border-rule px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent"
        >
          {t("request.editDates")}
        </button>

        {canCancel && (
          <cancelFetcher.Form
            method="post"
            onSubmit={(event) => {
              if (!window.confirm(t("request.confirmCancel"))) event.preventDefault();
            }}
          >
            <input type="hidden" name="intent" value="cancel" />
            <button
              type="submit"
              disabled={cancelFetcher.state !== "idle"}
              className="rounded border border-rule px-3 py-1.5 text-sm text-muted hover:border-out hover:text-out"
            >
              {t("request.cancelRequest")}
            </button>
          </cancelFetcher.Form>
        )}
      </div>

      {cancelFetcher.data && !cancelFetcher.data.ok && (
        <p className="text-sm text-out">{t(cancelFetcher.data.error)}</p>
      )}

      {editing && (
        <editFetcher.Form
          method="post"
          id={`edit-dates-${id}`}
          className="flex flex-col gap-4 rounded border border-rule bg-card p-4"
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
            <p role="alert" className="rounded bg-out-bg px-3 py-2 text-sm text-out">
              {t(editResult.error)}
              {editResult.conflicts && editResult.conflicts.length > 0 && (
                <> — {editResult.conflicts.join(", ")}</>
              )}
            </p>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-sm text-muted underline underline-offset-4 hover:text-ink"
            >
              {t("request.cancel")}
            </button>
            <button
              type="submit"
              disabled={editFetcher.state !== "idle"}
              className="rounded bg-accent px-4 py-2 text-sm font-medium text-white disabled:bg-sunk disabled:text-faint"
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
};

function ItemRow({
  id,
  item,
  isAdmin,
  status,
}: {
  id: string;
  item: Item;
  isAdmin: boolean;
  status: RequestStatus;
}) {
  const t = useT();
  const fetcher = useFetcher<typeof action>();
  const showHandoverActions = isAdmin && status === "APPROVED";

  return (
    <li className="flex items-center justify-between gap-2">
      <span>
        {item.name}
        {item.fromKitName && (
          <span className="ml-2 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
            {item.fromKitName}
          </span>
        )}
      </span>

      <span className="flex items-center gap-2">
        {item.returned ? (
          <span className="font-mono text-[0.65rem] uppercase tracking-wider text-faint">
            {t("requests.item.returned")}
          </span>
        ) : item.pickedUp ? (
          <span className="font-mono text-[0.65rem] uppercase tracking-wider text-held">
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
              className="rounded border border-rule px-2 py-1 font-mono text-[0.62rem] uppercase tracking-wider text-muted hover:border-accent hover:text-accent"
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
              className="rounded border border-rule px-2 py-1 font-mono text-[0.62rem] uppercase tracking-wider text-muted hover:border-accent hover:text-accent"
            >
              {t("requests.admin.markReturned")}
            </button>
          </fetcher.Form>
        )}
      </span>
    </li>
  );
}

/* -------------------------------------------------------------- admin */

function AdminSection({
  id,
  status,
  admin,
}: {
  id: string;
  status: RequestStatus;
  admin: { note: string | null; holderName: string; holderEmail: string };
}) {
  const t = useT();
  const noteFetcher = useFetcher<typeof action>();
  const decisionFetcher = useFetcher<typeof action>();
  const reminderFetcher = useFetcher<typeof action>();

  return (
    <section className="mt-8 rounded border border-rule bg-card p-4">
      <span className="font-mono text-[0.66rem] uppercase tracking-widest text-faint">
        {t("requests.admin.heading")}
      </span>

      <p className="mt-2 text-sm">
        {t("requests.admin.requestedBy")}{" "}
        <strong className="font-medium">{admin.holderName}</strong>{" "}
        <span className="text-muted">({admin.holderEmail})</span>
      </p>

      {status === "PENDING" && (
        <div className="mt-4 flex gap-2">
          <decisionFetcher.Form method="post">
            <input type="hidden" name="intent" value="approve" />
            <button
              type="submit"
              disabled={decisionFetcher.state !== "idle"}
              className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:bg-sunk disabled:text-faint"
            >
              {t("requests.admin.approve")}
            </button>
          </decisionFetcher.Form>
          <decisionFetcher.Form method="post">
            <input type="hidden" name="intent" value="reject" />
            <button
              type="submit"
              disabled={decisionFetcher.state !== "idle"}
              className="rounded border border-rule px-3 py-1.5 text-sm text-muted hover:border-out hover:text-out"
            >
              {t("requests.admin.reject")}
            </button>
          </decisionFetcher.Form>
        </div>
      )}
      {decisionFetcher.data && !decisionFetcher.data.ok && (
        <p className="mt-2 text-sm text-out">{t(decisionFetcher.data.error)}</p>
      )}

      {status === "APPROVED" && (
        <reminderFetcher.Form method="post" className="mt-4">
          <input type="hidden" name="intent" value="reminder" />
          <button
            type="submit"
            disabled={reminderFetcher.state !== "idle"}
            className="rounded border border-accent px-3 py-1.5 text-sm font-medium text-accent enabled:hover:bg-accent-soft disabled:cursor-not-allowed disabled:border-rule disabled:text-faint"
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

      <noteFetcher.Form method="post" className="mt-5 flex flex-col gap-2">
        <input type="hidden" name="intent" value="note" />
        <label
          htmlFor={`note-${id}`}
          className="font-mono text-[0.66rem] uppercase tracking-widest text-faint"
        >
          {t("requests.admin.note")}
        </label>
        <textarea
          id={`note-${id}`}
          name="note"
          rows={3}
          defaultValue={admin.note ?? ""}
          className="rounded border border-rule bg-card px-3 py-2 text-sm focus:outline-2 focus:outline-offset-2 focus:outline-accent"
        />
        <button
          type="submit"
          disabled={noteFetcher.state !== "idle"}
          className="self-start rounded border border-rule px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent"
        >
          {t("requests.admin.saveNote")}
        </button>
      </noteFetcher.Form>
    </section>
  );
}

/* ---------------------------------------------------------------- chat */

type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
  authorIsAdmin: boolean;
  isMine: boolean;
};

function ChatSection({ id, messages }: { id: string; messages: ChatMessage[] }) {
  const t = useT();
  const lang = useLang();
  const fetcher = useFetcher<typeof action>();
  const formRef = useRef<HTMLFormElement>(null);

  // Il campo si svuota da solo dopo un invio riuscito, senza bisogno di
  // tenere il testo in uno stato React che dovremmo comunque azzerare.
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) {
      formRef.current?.reset();
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <section className="mt-8 border-t border-rule pt-4">
      <span className="font-mono text-[0.66rem] uppercase tracking-widest text-faint">
        {t("requests.chat.heading")}
      </span>

      <ul className="mt-3 flex flex-col gap-3">
        {messages.length === 0 && (
          <li className="text-sm text-muted">{t("requests.chat.empty")}</li>
        )}
        {messages.map((message) => (
          <li
            key={message.id}
            className={`max-w-[85%] rounded border border-rule p-3 text-sm ${
              message.isMine ? "ml-auto bg-accent-soft" : "bg-card"
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-1.5">
                <span className="font-medium">{message.authorName}</span>
                {message.authorIsAdmin && <AdminBadge />}
              </span>
              <span className="font-mono text-[0.62rem] text-faint">
                {new Date(message.createdAt).toLocaleString(lang, {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
          </li>
        ))}
      </ul>

      <fetcher.Form
        ref={formRef}
        method="post"
        className="mt-4 flex items-end gap-2"
      >
        <input type="hidden" name="intent" value="message" />
        <div className="flex-1">
          <label htmlFor={`body-${id}`} className="sr-only">
            {t("requests.chat.placeholder")}
          </label>
          <textarea
            id={`body-${id}`}
            name="body"
            rows={2}
            required
            placeholder={t("requests.chat.placeholder")}
            className="w-full rounded border border-rule bg-card px-3 py-2 text-sm focus:outline-2 focus:outline-offset-2 focus:outline-accent"
          />
        </div>
        <button
          type="submit"
          disabled={fetcher.state !== "idle"}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-white disabled:bg-sunk disabled:text-faint"
        >
          {t("requests.chat.send")}
        </button>
      </fetcher.Form>
      {fetcher.data && !fetcher.data.ok && (
        <p className="mt-2 text-sm text-out">{t(fetcher.data.error)}</p>
      )}
    </section>
  );
}
