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
import { PageShell } from "~/components/page";
import { buttonClass } from "~/components/button";
import { pageTitle } from "~/i18n/meta";
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
import { logAdminAction } from "~/lib/audit.server";
import { REQUEST_STATUS_LABELS } from "~/lib/request-status";
import { useFormatDay, useLang, useT } from "~/i18n/use-t";
import type { TranslationKey } from "~/i18n/dictionaries";
import type { RequestStatus } from "~/generated/prisma/enums";
import { AdminBadge } from "~/components/admin-badge";
import { PersonInline, PersonName } from "~/components/person";
import { fullLabelOf, type Person } from "~/lib/person";
import { DateRangeFields, daysBetweenInclusive } from "~/components/date-range-fields";
import { publishRequestChange } from "~/lib/events.server";
import { useLive } from "~/lib/use-live";
import { MAX_ORDINARY_SPAN_DAYS as ORDINARY_SPAN } from "~/lib/availability.shared";

export function meta({ matches }: Route.MetaArgs) {
  return [{ title: pageTitle(matches, "requests.detailHeading") }];
}

/**
 * La riga che finirà nel registro degli admin: cosa e quando, per esteso.
 *
 * Il testo si scrive **adesso** e non si ricalcola mai più — è il punto del
 * registro: fra sei mesi l'oggetto può essere archiviato e la richiesta
 * cancellata, ma «ha approvato Proiettore Epson (2026-08-20 → 2026-08-25)»
 * resta leggibile. Le date restano in ISO e non nel formato della lingua di
 * chi ha premuto: il registro lo leggono altri, magari in un'altra lingua.
 */
function requestDetailLine(req: {
  items: Array<{ asset: { name: string } }>;
  startDate: Date;
  endDate: Date;
}): string {
  const names = req.items.map((item) => item.asset.name).join(", ");
  return `${names} (${formatDay(req.startDate)} → ${formatDay(req.endDate)})`;
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
  if (!isAdminRole && !isOwner) throw new Response("Not found", { status: 404 });

  return req;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const isAdmin = user.role === "ADMIN";
  const req = await loadAuthorized(user.id, isAdmin, params.id);

  await markSeen(req, user.id, isAdmin);

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

/**
 * Il segnalibro: chi apre questa pagina l'ha vista.
 *
 * È ciò che fa esistere la sezione «messaggi da leggere» del Centro e il
 * pallino su «le mie richieste». Due date e non una tabella di lettura per
 * messaggio: vedi il commento sullo schema.
 *
 * **Si scrive solo quando serve davvero**, cioè quando c'è un messaggio più
 * recente del segnalibro. Senza questa guardia sarebbe una `UPDATE` a ogni
 * apertura — e con la chat che si aggiorna da sola le aperture diventano
 * molte, perché ogni colpetto ricarica il loader.
 *
 * Chi è admin **e** proprietario aggiorna tutti e due i segnalibri: sono due
 * ruoli sulla stessa pagina, non due persone.
 */
async function markSeen(
  req: {
    id: string;
    userId: string;
    adminSeenAt: Date | null;
    userSeenAt: Date | null;
    messages: Array<{ createdAt: Date }>;
  },
  userId: string,
  isAdmin: boolean
): Promise<void> {
  // I messaggi arrivano in ordine crescente: l'ultimo è in fondo.
  const last = req.messages.at(-1);
  if (!last) return;

  const isOwner = req.userId === userId;
  const stale = (mark: Date | null) => mark === null || last.createdAt > mark;

  const data: { adminSeenAt?: Date; userSeenAt?: Date } = {};
  if (isAdmin && stale(req.adminSeenAt)) data.adminSeenAt = new Date();
  if (isOwner && stale(req.userSeenAt)) data.userSeenAt = new Date();
  if (Object.keys(data).length === 0) return;

  await db.request.update({ where: { id: req.id }, data });
}

/**
 * La risposta di ogni intento che ha scritto qualcosa — e la campanella.
 *
 * Sta in una funzione sola perché gli intenti sono sette e il `return` era
 * scritto sette volte: aggiungerne un ottavo dimenticando la campanella
 * darebbe una pagina che si aggiorna dal vivo **quasi** sempre, che è il tipo
 * di difetto che nessuno segnala e tutti smettono di fidarsi.
 *
 * Sul canale non passa niente di quello che è cambiato: vedi
 * `lib/events.server.ts`.
 */
function changed(requestId: string, intent: string) {
  publishRequestChange(requestId);
  return { ok: true as const, intent };
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
    return changed(req.id, intent);
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
    // Tagliato qui e non solo nel browser: `maxLength` è un suggerimento che
  // un `curl` ignora, e questa è l'unica colonna di testo libero senza
  // tetto proprio. Stessa regola già applicata al corpo dei messaggi.
  const purpose = String(form.get("purpose") ?? "").trim().slice(0, 2000);
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
    return changed(req.id, intent);
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
      // Solo l'annullo *di un altro* finisce nel registro: chi ritira la
      // propria richiesta non sta esercitando un permesso da admin.
      await logAdminAction({
        actorId: user.id,
        action: "request.cancel",
        targetType: "Request",
        targetId: req.id,
        detail: requestDetailLine(req),
      });

      try {
        await notifyRequesterCancelled({
          to: {
            id: req.user.id,
            email: req.user.email,
            name: fullLabelOf(req.user),
          },
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
    return changed(req.id, intent);
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
    return changed(req.id, intent);
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

    await logAdminAction({
      actorId: admin.id,
      action: intent === "approve" ? "request.approve" : "request.reject",
      targetType: "Request",
      targetId: req.id,
      detail: `${fullLabelOf(req.user)} — ${requestDetailLine(req)}`,
    });

    try {
      await notifyRequesterDecision({
        to: {
          id: req.user.id,
          email: req.user.email,
          name: fullLabelOf(req.user),
        },
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
    return changed(req.id, intent);
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

    // Il passaggio di mano è per singolo oggetto (regola 2), quindi anche la
    // riga di registro lo è: «chi ha segnato quel ritiro» era la domanda
    // senza risposta da cui nasce tutto questo.
    await logAdminAction({
      actorId: admin.id,
      action: intent === "pickup" ? "requestItem.pickup" : "requestItem.return",
      targetType: "RequestItem",
      targetId: item.id,
      detail: `${item.asset.name} — ${fullLabelOf(req.user)}`,
    });

    return changed(req.id, intent);
  }

  if (intent === "reminder") {
    try {
      /* `deliver` non solleva: restituisce `false`. Un promemoria che non
         è arrivato deve dirlo a chi ha premuto il pulsante, o l'admin resta
         convinto di aver sollecitato qualcuno che non ha saputo niente. */
      const delivered = await sendReturnReminder({
        to: {
          id: req.user.id,
          email: req.user.email,
          name: fullLabelOf(req.user),
        },
        itemNames: req.items.map((item) => item.asset.name),
        endDate: req.endDate,
        requestId: req.id,
      });
      if (!delivered) {
        return { ok: false as const, error: "request.errorReminderFailed" as TranslationKey };
      }
    } catch (error) {
      console.error("Invio promemoria fallito:", error);
      return { ok: false as const, error: "request.errorReminderFailed" as TranslationKey };
    }
    return changed(req.id, intent);
  }

  return { ok: false as const, error: "request.errorGeneric" as TranslationKey };
}

export default function RequestDetail({ loaderData }: Route.ComponentProps) {
  const { id, startDate, endDate, status, purpose, today, isOwner, items, messages, admin } =
    loaderData;
  const t = useT();
  const formatDayLabel = useFormatDay();

  /* La chat si aggiorna da sola: è qui che ci si accorda su un ritiro, e una
     pagina che mostra la conversazione di dieci minuti fa è peggio che non
     mostrarla — chi la guarda crede di essere aggiornato. Vale anche per le
     decisioni: chi ha chiesto vede l'approvazione senza ricaricare. */
  useLive(`/api/stream?request=${id}`);

  const canManage = isOwner || Boolean(admin);
  const canEditOrCancel = canManage && (status === "PENDING" || status === "APPROVED");
  const anyPickedUp = items.some((item) => item.pickedUp);

  return (
    <main>
      <PageShell width="narrow" className="pb-24 pt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-serif text-2xl font-semibold tracking-tight">
            {formatDayLabel(startDate)} — {formatDayLabel(endDate)}
          </h1>
          <span className="rounded-full bg-sunk px-2.5 py-1 font-mono text-[0.68rem] font-medium uppercase tracking-wider text-muted">
            {t(REQUEST_STATUS_LABELS[status])}
          </span>
        </div>

        {purpose && <p className="mt-2 text-sm text-muted">{purpose}</p>}

        {canEditOrCancel && (
          <RequestActions
            id={id}
            today={today}
            startDate={startDate}
            endDate={endDate}
            purpose={purpose}
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
}: {
  id: string;
  today: string;
  startDate: string;
  endDate: string;
  purpose: string | null;
  canCancel: boolean;
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
          className={buttonClass("quiet", "sm")}
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
          <span className="ml-2 font-mono text-[0.65rem] uppercase tracking-wider text-muted">
            {item.fromKitName}
          </span>
        )}
      </span>

      <span className="flex items-center gap-2">
        {item.returned ? (
          <span className="font-mono text-[0.65rem] uppercase tracking-wider text-muted">
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
              className={buttonClass("quiet", "sm", "font-mono text-[0.62rem] uppercase tracking-wider")}
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
              className={buttonClass("quiet", "sm", "font-mono text-[0.62rem] uppercase tracking-wider")}
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
  admin: { note: string | null; holder: Person; holderEmail: string };
}) {
  const t = useT();
  const noteFetcher = useFetcher<typeof action>();
  const decisionFetcher = useFetcher<typeof action>();
  const reminderFetcher = useFetcher<typeof action>();

  return (
    <section className="mt-8 rounded border border-rule bg-card p-4">
      <span className="font-mono text-[0.66rem] uppercase tracking-widest text-muted">
        {t("requests.admin.heading")}
      </span>

      <p className="mt-2 text-sm">
        {t("requests.admin.requestedBy")}{" "}
        <PersonName person={admin.holder} className="font-medium" />{" "}
        <span className="text-muted">({admin.holderEmail})</span>
      </p>

      {status === "PENDING" && (
        <div className="mt-4 flex gap-2">
          <decisionFetcher.Form method="post">
            <input type="hidden" name="intent" value="approve" />
            <button
              type="submit"
              disabled={decisionFetcher.state !== "idle"}
              className={buttonClass("primary", "sm")}
            >
              {t("requests.admin.approve")}
            </button>
          </decisionFetcher.Form>
          <decisionFetcher.Form method="post">
            <input type="hidden" name="intent" value="reject" />
            <button
              type="submit"
              disabled={decisionFetcher.state !== "idle"}
              className={buttonClass("danger", "sm")}
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

      <noteFetcher.Form method="post" className="mt-5 flex flex-col gap-2">
        <input type="hidden" name="intent" value="note" />
        <label
          htmlFor={`note-${id}`}
          className="font-mono text-[0.66rem] uppercase tracking-widest text-muted"
        >
          {t("requests.admin.note")}
        </label>
        <textarea
          id={`note-${id}`}
          name="note"
          rows={3}
          defaultValue={admin.note ?? ""}
          className="min-h-11 rounded border border-rule bg-card px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={noteFetcher.state !== "idle"}
          className={buttonClass("quiet", "sm", "self-start")}
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
  author: Person;
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
      <span className="font-mono text-[0.66rem] uppercase tracking-widest text-muted">
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
            {/* `items-baseline` funziona solo perché avatar e nome sono un
                pezzo di testo in linea e non un flex annidato: un flex prende
                come linea di base il bordo inferiore della propria immagine, e
                l'intestazione tornerebbe sfasata (vedi `PersonInline`). */}
            <div className="flex items-baseline justify-between gap-3">
              <span>
                <PersonInline person={message.author} />
                {/* Il margine al posto dello spazio scritto: uno spazio è un
                    punto dove andare a capo, e in una bolla stretta il
                    cartellino finiva da solo sulla riga sotto. */}
                {message.authorIsAdmin && (
                  <span className="ml-2 align-middle">
                    <AdminBadge />
                  </span>
                )}
              </span>
              <span className="shrink-0 font-mono text-[0.62rem] text-muted">
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
            className="min-h-11 w-full rounded border border-rule bg-card px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={fetcher.state !== "idle"}
          className={buttonClass("primary")}
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
