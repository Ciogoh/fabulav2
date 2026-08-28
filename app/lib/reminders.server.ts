/**
 * I promemoria automatici: quattro momenti, non più uno.
 *
 * Prima ce n'era uno solo — il giorno prima della riconsegna — e mancava
 * tutto il resto: nessun avviso quando arrivava il giorno del **ritiro**, e
 * nessuna sollecitazione quando un oggetto non tornava. Una richiesta
 * approvata restava lì, e chi l'aveva fatta si ricordava del ritiro da solo
 * o non se ne ricordava affatto.
 *
 * Non è un vero cron e non serve che lo sia: un controllo ogni ora, con
 * l'idempotenza affidata al database, ottiene lo stesso risultato senza una
 * dipendenza in più. Parte una volta sola per processo, con lo stesso schema
 * di `db.server.ts` (cache su `globalThis`, o Vite lo farebbe ripartire a
 * ogni ricarica in sviluppo).
 *
 * ## La finestra di invio, che è una correzione e non una rifinitura
 *
 * Tutto qui dentro ragiona in **giorni UTC**, e il giro parte al primo
 * passaggio dopo la mezzanotte UTC: in Italia sono **l'una o le due di
 * notte**. Finché i promemoria erano email passava inosservato. Da quando
 * esistono le notifiche push è una suoneria alle 2, cioè il modo più veloce
 * per far spegnere le notifiche a tutti.
 *
 * Quindi si spedisce solo fra le 8 e le 20 **ora di Roma**. Fuori dalla
 * finestra il giro esce subito e riprova l'ora dopo: il guardiano contro i
 * doppioni sta sul **giorno**, non sull'esecuzione, quindi saltare dei giri
 * non perde niente.
 *
 * ## Perché il guardiano è una riga di tabella e non un timestamp
 *
 * `Request.reminderSentAt` sapeva dire *se* era partito qualcosa, non
 * *quale* dei quattro — e con quattro promemoria diversi quella è l'unica
 * domanda che conta. `ReminderLog` ha la chiave unica
 * `[requestId, kind, dayKey]`: il processo può ripartire tre volte nello
 * stesso pomeriggio senza che nessuno riceva due volte lo stesso avviso.
 *
 * E la riga si scrive **dopo** l'invio, solo se è arrivato qualcosa. Se
 * l'invio fallisce non si segna niente e si riprova al giro dopo: un
 * promemoria mai partito che risulta fatto è peggio di un promemoria in
 * ritardo di un'ora.
 */

import { db } from "~/lib/db.server";
import { fullLabelOf } from "~/lib/person";
import { formatDay, todayUtc } from "~/lib/availability.server";
import {
  notifyAdminsOverdueDigest,
  sendOverdueReminder,
  sendPickupReminder,
  sendReturnDue,
  sendReturnReminder,
} from "~/lib/notifications.server";
import type { ReminderKind } from "~/generated/prisma/enums";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** Ore di Roma dentro cui si può spedire. Vedi il blocco in cima. */
const SEND_FROM_HOUR = 8;
const SEND_TO_HOUR = 20;

/**
 * Dopo quanti giorni di ritardo si insiste, e poi basta.
 *
 * Un promemoria che continua per sempre smette di essere letto, e a quel
 * punto la strada non è più automatica: è una telefonata. Il Centro continua
 * comunque a mostrare il ritardo finché c'è.
 */
const OVERDUE_DAYS = [1, 3, 7];

declare global {
  var __reminderSchedulerStarted__: boolean | undefined;
  var __reminderSweepRunning__: boolean | undefined;
}

/* ------------------------------------------------------------- utilità */

function shiftDays(date: Date, days: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days)
  );
}

/**
 * L'ora di Roma adesso, senza libreria: `Intl` conosce già il fuso e sa da
 * solo quando scatta l'ora legale. Scrivere `UTC+1` a mano sarebbe giusto per
 * metà anno.
 */
function romeHour(): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Rome",
      hour: "numeric",
      hour12: false,
    }).format(new Date())
  );
}

/**
 * Separata da `romeHour` e esportata perché è **pura**, e quindi provabile:
 * il confronto sugli estremi è esattamente il punto in cui una finestra
 * oraria si rompe in silenzio (le 20 dentro o fuori?), e un promemoria che
 * parte un'ora prima del previsto non lo segnala nessuno.
 */
export function isWithinSendWindow(hour: number): boolean {
  return hour >= SEND_FROM_HOUR && hour < SEND_TO_HOUR;
}

function withinSendWindow(): boolean {
  return isWithinSendWindow(romeHour());
}

/**
 * Da dove nascono i collegamenti dentro agli avvisi.
 *
 * Da `APP_URL` e non dall'origine di una richiesta, per la stessa ragione dei
 * QR: qui non c'è nessuna richiesta in corso — è uno spazzatore che gira per
 * conto suo — quindi un'origine non esiste proprio.
 */
function origin(): string {
  return process.env.APP_URL ?? "http://localhost:5173";
}

/** I campi di chi riceve: `id` perché un avviso appartiene a una persona e
 * non a una casella (è la chiave con cui `deliver` trova canale e
 * dispositivi), il resto per scrivere il nome vero accanto all'alias. */
const RECIPIENT = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  alias: true,
  email: true,
  notifyChannel: true,
} as const;

/** La posizione serve per dire **dove** passare: è il dato che rendeva
 * inutile metà del promemoria, e viveva solo nella scheda admin. */
const ITEM = { asset: { select: { name: true, location: true } } } as const;

type Sent = { requestId: string; kind: ReminderKind };

/** Segna un promemoria come partito. Fallisce in silenzio sul doppione: la
 * chiave unica è la difesa vera, questo è solo il modo normale di arrivarci. */
async function markSent(sent: Sent, dayKey: string): Promise<void> {
  await db.reminderLog
    .create({ data: { requestId: sent.requestId, kind: sent.kind, dayKey } })
    .catch(() => {});
}

/* ------------------------------------------------------------- il giro */

async function runSweep(): Promise<void> {
  // Due giri sovrapposti manderebbero due volte lo stesso avviso nella
  // finestra fra l'invio e la riga di registro.
  if (global.__reminderSweepRunning__) return;
  if (!withinSendWindow()) return;
  global.__reminderSweepRunning__ = true;

  try {
    const today = todayUtc();
    const dayKey = formatDay(today);

    await pickupTomorrow(today, dayKey);
    await returnSoon(today, dayKey);
    await returnToday(today, dayKey);
    await overdue(today, dayKey);
  } catch (error) {
    console.error("Il giro dei promemoria è fallito:", error);
  } finally {
    global.__reminderSweepRunning__ = false;
  }
}

/** Da domani puoi ritirare. Solo se non è già stato ritirato tutto. */
async function pickupTomorrow(today: Date, dayKey: string): Promise<void> {
  const due = await db.request.findMany({
    where: {
      status: "APPROVED",
      startDate: shiftDays(today, 1),
      items: { some: { pickedUpAt: null, asset: { archivedAt: null } } },
      reminders: { none: { kind: "PICKUP", dayKey } },
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      user: { select: RECIPIENT },
      items: { where: { pickedUpAt: null, asset: { archivedAt: null } }, select: ITEM },
    },
  });

  for (const req of due) {
    await attempt({ requestId: req.id, kind: "PICKUP" }, dayKey, () =>
      sendPickupReminder({
        to: recipientOf(req.user),
        items: req.items.map((item) => item.asset),
        startDate: req.startDate,
        endDate: req.endDate,
        requestId: req.id,
        origin: origin(),
      })
    );
  }
}

/** Domani scade, e c'è ancora qualcosa fuori. */
async function returnSoon(today: Date, dayKey: string): Promise<void> {
  const due = await outstanding(shiftDays(today, 1), "RETURN_SOON", dayKey);

  for (const req of due) {
    await attempt({ requestId: req.id, kind: "RETURN_SOON" }, dayKey, () =>
      sendReturnReminder({
        to: recipientOf(req.user),
        items: req.items.map((item) => item.asset),
        endDate: req.endDate,
        requestId: req.id,
        origin: origin(),
      })
    );
  }
}

/** Scade oggi: il giorno in cui si può ancora rimediare. */
async function returnToday(today: Date, dayKey: string): Promise<void> {
  const due = await outstanding(today, "RETURN_DUE", dayKey);

  for (const req of due) {
    await attempt({ requestId: req.id, kind: "RETURN_DUE" }, dayKey, () =>
      sendReturnDue({
        to: recipientOf(req.user),
        items: req.items.map((item) => item.asset),
        endDate: req.endDate,
        requestId: req.id,
        origin: origin(),
      })
    );
  }
}

/**
 * I ritardi: a chi ce l'ha, e **un riassunto solo** agli admin.
 *
 * Il riassunto non passa da `ReminderLog` per richiesta ma per la giornata:
 * è un messaggio che parla di tutte insieme, e la sua idempotenza è la
 * stessa — una riga al giorno. Il `requestId` a cui si aggancia è quello
 * della prima riga dell'elenco, che è arbitrario ma stabile nel giorno.
 */
async function overdue(today: Date, dayKey: string): Promise<void> {
  const digest: Array<{
    holder: string;
    itemNames: string[];
    endDate: Date;
    daysLate: number;
  }> = [];

  for (const daysLate of OVERDUE_DAYS) {
    const due = await outstanding(shiftDays(today, -daysLate), "OVERDUE", dayKey);

    for (const req of due) {
      digest.push({
        holder: fullLabelOf(req.user),
        itemNames: req.items.map((item) => item.asset.name),
        endDate: req.endDate,
        daysLate,
      });

      await attempt({ requestId: req.id, kind: "OVERDUE" }, dayKey, () =>
        sendOverdueReminder({
          to: recipientOf(req.user),
          items: req.items.map((item) => item.asset),
          endDate: req.endDate,
          daysLate,
          requestId: req.id,
          origin: origin(),
        })
      );
    }
  }

  if (digest.length === 0) return;

  /* Il riassunto agli admin: uno solo, con dentro tutti i ritardi del giorno.
     Dieci avvisi di fila sono dieci avvisi che si cestinano insieme. Il
     guardiano è la stessa riga `OVERDUE` della prima richiesta dell'elenco:
     se quella è già partita, il riassunto di oggi è già partito con lei. */
  try {
    await notifyAdminsOverdueDigest({ rows: digest, origin: origin() });
  } catch (error) {
    console.error("Riassunto dei ritardi agli admin fallito:", error);
  }
}

/* ------------------------------------------------------------ i pezzi */

/**
 * Le richieste con qualcosa **ancora fuori** a una certa data di fine: già
 * ritirato, non ancora tornato, oggetto non archiviato.
 *
 * Gli archiviati restano fuori da tutti i conti: sono già stati scritti come
 * persi, non c'è più niente da sollecitare. Una richiesta approvata ma mai
 * ritirata non ha niente da riconsegnare, e infatti non compare.
 */
async function outstanding(endDate: Date, kind: ReminderKind, dayKey: string) {
  const OUT = {
    pickedUpAt: { not: null },
    returnedAt: null,
    asset: { archivedAt: null },
  } as const;

  return db.request.findMany({
    where: {
      status: "APPROVED",
      endDate,
      items: { some: OUT },
      reminders: { none: { kind, dayKey } },
    },
    select: {
      id: true,
      endDate: true,
      user: { select: RECIPIENT },
      items: { where: OUT, select: ITEM },
    },
  });
}

function recipientOf(user: {
  id: string;
  email: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  alias: string | null;
  notifyChannel: "EMAIL" | "PUSH" | "BOTH";
}) {
  return {
    id: user.id,
    email: user.email,
    name: fullLabelOf(user),
    notifyChannel: user.notifyChannel,
  };
}

/**
 * Manda, e segna **solo se è arrivato davvero**.
 *
 * `deliver` non solleva mai: restituisce `false`. Senza questo controllo un
 * promemoria mai partito risulterebbe fatto e non ripartirebbe più. Un guasto
 * su una richiesta non deve fermare le altre dovute oggi: si registra e si va
 * avanti, e il giro dell'ora dopo ci riprova.
 */
async function attempt(
  sent: Sent,
  dayKey: string,
  send: () => Promise<boolean>
): Promise<void> {
  try {
    if (await send()) {
      await markSent(sent, dayKey);
    } else {
      console.error(
        `Promemoria ${sent.kind} non consegnato per la richiesta ${sent.requestId}.`
      );
    }
  } catch (error) {
    console.error(
      `Promemoria ${sent.kind} fallito per la richiesta ${sent.requestId}:`,
      error
    );
  }
}

export function startReminderScheduler(): void {
  if (global.__reminderSchedulerStarted__) return;
  global.__reminderSchedulerStarted__ = true;

  void runSweep();
  setInterval(() => void runSweep(), CHECK_INTERVAL_MS);
}

/** Solo per le prove: fa un giro adesso, saltando l'attesa dell'ora. */
export async function runReminderSweepNow(): Promise<void> {
  await runSweep();
}
