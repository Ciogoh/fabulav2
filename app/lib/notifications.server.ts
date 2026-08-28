/**
 * Tutti gli avvisi legati al ciclo di vita di una richiesta, in un posto solo.
 *
 * Restano tutti in inglese, non tradotti per lingua del destinatario: è già
 * così per ogni email di Fabula (codice OTP, reimpostazione password), quindi
 * i nuovi seguono lo stesso schema invece di inventarne uno a parte.
 *
 * ── Il confine che tiene in piedi tutto il resto ─────────────────────────
 *
 *   La preferenza di canale vale **solo per gli avvisi di prestito**, cioè
 *   solo per quello che sta in questo file. Codice di accesso, reimpostazione
 *   della password e comunicazioni sulla piattaforma restano email, sempre,
 *   per chiunque.
 *
 * Il confine esiste già nel codice e qui viene solo dichiarato:
 * `email.server.ts` è il postino grezzo che usano l'accesso e Better Auth;
 * questo file è il ciclo di vita di una richiesta, ed è **l'unico posto che
 * consulta `User.notifyChannel`**. Una notifica push che non arriva è un
 * fastidio; un codice di accesso che non arriva chiude fuori una persona
 * dalla piattaforma.
 *
 * ── Cosa può stare dentro a una notifica ────────────────────────────────
 *
 *   Nel corpo di una notifica push non vanno nomi di persona né luoghi, e
 *   nemmeno i nomi degli oggetti.
 *
 * Una notifica si legge a schermo bloccato, sul tavolo di un bar, in mezzo
 * alla gente: è una superficie semi-pubblica. «3 items · 2026-08-20 →
 * 2026-08-25» basta a far capire di cosa si tratta; il resto si vede aprendo,
 * cioè dopo aver sbloccato il telefono. Gli oggetti restano fuori anche se il
 * catalogo è pubblico: un avviso che annuncia a chi passa che hai in casa una
 * certa attrezzatura è un problema diverso dal catalogo, che dice solo che
 * l'attrezzatura esiste. Le email invece i nomi ce li hanno: si leggono in
 * una casella, non su una vetrina.
 */

import type { NotifyChannel } from "~/generated/prisma/enums";
import { formatDay } from "~/lib/availability.server";
import { db } from "~/lib/db.server";
import { extraAdminEmails, sendEmail } from "~/lib/email.server";
import { sendPush } from "~/lib/push.server";

type RequestSummary = {
  requestId: string;
  itemNames: string[];
  startDate: Date;
  endDate: Date;
  origin: string;
};

/**
 * Chi riceve un avviso.
 *
 * Serve `id` e non solo l'indirizzo, perché le notifiche appartengono a una
 * persona e non a una casella di posta. `notifyChannel` è facoltativo: se chi
 * chiama l'ha già letto — come fa il ventaglio agli admin, che li carica
 * tutti in una volta — lo passa e si risparmia una interrogazione a testa;
 * altrimenti `deliver` se lo va a prendere.
 */
export type Recipient = {
  id: string;
  email: string;
  /** Il nome vero accanto all'alias: chi legge deve riconoscersi anche se
   * l'alias se l'era dimenticato. */
  name: string;
  notifyChannel?: NotifyChannel;
};

function requestLink(origin: string, requestId: string): string {
  return `${origin}/requests/${requestId}`;
}

/** La riga compatta che va nelle notifiche: quantità e date, niente nomi. */
function summaryLine(params: RequestSummary): string {
  const count = params.itemNames.length;
  return `${count} ${count === 1 ? "item" : "items"} · ${formatDay(params.startDate)} → ${formatDay(params.endDate)}`;
}

/**
 * Manda un avviso a una persona, sul canale che ha scelto.
 *
 * **Non solleva mai.** Un avviso è la coda di un'azione già compiuta — una
 * richiesta scritta, un'approvazione data, un oggetto consegnato a mano — e
 * non deve poterla annullare. Gli errori finiscono nel registro e basta.
 *
 * **Restituisce se è arrivato qualcosa**, ed è la parte che conta per lo
 * spazzatore dei promemoria (`reminders.server.ts`): `false` significa
 * «questa persona non è stata avvisata», quindi il promemoria non va segnato
 * come fatto. Senza questo valore non c'è modo di distinguere «mandato» da
 * «nessun canale ha funzionato», e il promemoria o sparisce o si ripete in
 * eterno.
 */
export async function deliver(
  to: Recipient,
  message: {
    subject: string;
    text: string;
    push: { title: string; body: string; url: string; tag?: string };
  }
): Promise<boolean> {
  const channel = to.notifyChannel ?? (await channelOf(to.id));

  let pushed = 0;
  if (channel === "PUSH" || channel === "BOTH") {
    pushed = await sendPush(to.id, message.push);
  }

  /* La rete di sicurezza, ed è la riga che rende questa funzione affidabile:
     chi ha scelto **solo** le notifiche ma non ha nessun dispositivo vivo
     riceve comunque l'email. Le iscrizioni push muoiono in silenzio — dati
     del browser puliti, icona tolta dalla schermata Home, mesi di inattività
     su iOS — e senza questo ripiego una richiesta può restare in coda per
     settimane senza che nessuno sappia che c'è. */
  const alsoEmail = channel === "EMAIL" || channel === "BOTH" || pushed === 0;
  if (!alsoEmail) return true;

  try {
    await sendEmail({ to: to.email, subject: message.subject, text: message.text });
    return true;
  } catch (error) {
    console.error(`Avviso non consegnato a ${to.email}:`, error);
    return pushed > 0;
  }
}

/** Il canale di una persona, quando chi chiama non l'ha già letto. */
async function channelOf(userId: string): Promise<NotifyChannel> {
  const user = await db.user
    .findUnique({ where: { id: userId }, select: { notifyChannel: true } })
    .catch(() => null);

  // Chi non si trova più — cancellato fra l'azione e l'avviso — prende il
  // valore predefinito, e l'email fallirà da sola senza far cadere nulla.
  return user?.notifyChannel ?? "EMAIL";
}

/**
 * Chi va avvisato di una richiesta nuova.
 *
 * Prima era una lista fissa nel `.env`, e una lista di indirizzi non ha
 * preferenze: chi voleva solo le notifiche continuava a ricevere la posta.
 * Adesso i destinatari veri sono **gli utenti con ruolo `ADMIN`** letti dal
 * database, ciascuno sul canale che ha scelto.
 *
 * `ADMIN_EMAILS` resta, per la casella condivisa dell'associazione o per chi
 * vuole l'avviso senza avere un account — ma gli indirizzi che coincidono con
 * un admin registrato vengono scartati (in `email.server.ts`), o l'avviso
 * rientrerebbe dalla porta di servizio proprio a chi aveva chiesto di non
 * riceverlo.
 */
async function adminRecipients(): Promise<{ people: Recipient[]; extras: string[] }> {
  const admins = await db.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, email: true, name: true, notifyChannel: true },
  });

  return {
    people: admins,
    extras: extraAdminEmails(admins.map((admin) => admin.email)),
  };
}

export async function notifyAdminsNewRequest(
  params: RequestSummary & {
    requesterName: string;
    requesterEmail: string;
    purpose: string | null;
  }
): Promise<void> {
  const { people, extras } = await adminRecipients();
  if (people.length === 0 && extras.length === 0) return;

  const subject = `Fabula: new request from ${params.requesterName}`;
  const text =
    `${params.requesterName} (${params.requesterEmail}) requested: ${params.itemNames.join(", ")}\n` +
    `From ${formatDay(params.startDate)} to ${formatDay(params.endDate)}.\n` +
    (params.purpose ? `Reason: ${params.purpose}\n` : "") +
    `\n${requestLink(params.origin, params.requestId)}`;

  await Promise.all([
    ...people.map((admin) =>
      deliver(admin, {
        subject,
        text,
        push: {
          title: "New request",
          // Senza il nome di chi ha chiesto: la coda di approvazione è a un
          // tocco di distanza e lì il nome c'è, insieme al resto.
          body: summaryLine(params),
          url: "/admin?vista=approvare",
          tag: `request:${params.requestId}`,
        },
      })
    ),
    // Gli indirizzi in più non sono persone di Fabula: niente preferenze,
    // niente notifiche, solo posta.
    ...extras.map((to) =>
      sendEmail({ to, subject, text }).catch((error) =>
        console.error(`Avviso non consegnato all'indirizzo in più ${to}:`, error)
      )
    ),
  ]);
}

export async function notifyRequesterDecision(
  params: RequestSummary & {
    to: Recipient;
    decision: "approved" | "rejected";
  }
): Promise<void> {
  const approved = params.decision === "approved";

  await deliver(params.to, {
    subject: approved ? "Fabula: request approved" : "Fabula: request not approved",
    text:
      `Hi ${params.to.name},\n\n` +
      `Your request for ${params.itemNames.join(", ")} ` +
      `(from ${formatDay(params.startDate)} to ${formatDay(params.endDate)}) ` +
      (approved ? "has been approved.\n" : "has not been approved.\n") +
      `\n${requestLink(params.origin, params.requestId)}`,
    push: {
      title: approved ? "Request approved" : "Request not approved",
      body: summaryLine(params),
      url: `/requests/${params.requestId}`,
      tag: `request:${params.requestId}`,
    },
  });
}

export async function notifyRequesterCancelled(
  params: RequestSummary & { to: Recipient }
): Promise<void> {
  await deliver(params.to, {
    subject: "Fabula: request cancelled",
    text:
      `Hi ${params.to.name},\n\n` +
      `An admin has cancelled your request for ${params.itemNames.join(", ")} ` +
      `(from ${formatDay(params.startDate)} to ${formatDay(params.endDate)}). ` +
      `If you think this is a mistake, write in the request's chat.\n` +
      `\n${requestLink(params.origin, params.requestId)}`,
    push: {
      title: "Request cancelled",
      body: summaryLine(params),
      url: `/requests/${params.requestId}`,
      tag: `request:${params.requestId}`,
    },
  });
}

/**
 * La conferma di una consegna fatta di persona, col QR.
 *
 * Non è una decisione da comunicare — chi la riceve era lì, ha appena preso
 * l'oggetto in mano — ma la traccia scritta di quando va restituito, che è
 * l'unica cosa che dopo mezz'ora nessuno ricorda più. Per questo la data di
 * riconsegna è la frase principale e non un dettaglio in coda.
 */
export async function notifyDirectHandover(
  params: RequestSummary & { to: Recipient }
): Promise<void> {
  await deliver(params.to, {
    subject: "Fabula: item handed over",
    text:
      `Hi ${params.to.name},\n\n` +
      `You picked up: ${params.itemNames.join(", ")}\n` +
      `Please return by ${formatDay(params.endDate)}.\n` +
      `\n${requestLink(params.origin, params.requestId)}`,
    push: {
      title: "Picked up",
      body: `Return by ${formatDay(params.endDate)}`,
      url: `/requests/${params.requestId}`,
      tag: `request:${params.requestId}`,
    },
  });
}

/**
 * Il promemoria di riconsegna.
 *
 * L'unico avviso che non segue un'azione appena compiuta da qualcuno: parte
 * da uno spazzatore (`reminders.server.ts`), che deve sapere se è arrivato
 * per decidere se riprovare domani. Per questo — sola fra le cinque — questa
 * funzione restituisce l'esito invece di ingoiarlo.
 */
export async function sendReturnReminder(params: {
  to: Recipient;
  /* Con la posizione, come gli altri tre: era l'unico dei quattro promemoria
     che diceva *cosa* riportare senza dire **dove**, e la posizione è metà
     della risposta — soprattutto quando i pezzi stanno in due magazzini. */
  items: Array<{ name: string; location: string | null }>;
  endDate: Date;
  requestId: string;
  origin: string;
}): Promise<boolean> {
  return deliver(params.to, {
    subject: "Fabula: return reminder",
    text:
      `Hi ${params.to.name},\n\n` +
      `A reminder: please bring back by ${formatDay(params.endDate)}:\n` +
      `${placesBlock(params.items)}\n` +
      `\n${requestLink(params.origin, params.requestId)}`,
    push: {
      title: "Return reminder",
      body: `Due ${formatDay(params.endDate)} · ${params.items.length} ${params.items.length === 1 ? "item" : "items"}`,
      url: `/requests/${params.requestId}`,
      tag: `request:${params.requestId}`,
    },
  });
}

/**
 * Dove passare a ritirare, e dove riportare.
 *
 * Sta **solo nelle email**: la regola in cima al file dice che in una notifica
 * push non vanno luoghi, e questa è esattamente quella riga. Gli oggetti si
 * raggruppano per posizione invece di scegliere la prima — una richiesta con
 * pezzi in due magazzini, riassunta in un indirizzo solo, manda qualcuno a
 * cercare una cosa dove non c'è. Chi non ha posizione finisce in fondo, con
 * l'unica risposta onesta: mettersi d'accordo in chat.
 */
function placesBlock(items: Array<{ name: string; location: string | null }>): string {
  const byPlace = new Map<string, string[]>();
  for (const item of items) {
    const key = item.location?.trim() || "";
    byPlace.set(key, [...(byPlace.get(key) ?? []), item.name]);
  }

  const lines: string[] = [];
  for (const [place, names] of byPlace) {
    lines.push(
      place
        ? `  ${names.join(", ")} — ${place}`
        : `  ${names.join(", ")} — to agree in the chat`
    );
  }
  return lines.join("\n");
}

/** Il giorno prima del ritiro. Il promemoria che mancava del tutto: finora
 * una richiesta approvata restava lì, e chi l'aveva fatta si ricordava del
 * ritiro da solo o non se ne ricordava affatto. */
export async function sendPickupReminder(params: {
  to: Recipient;
  items: Array<{ name: string; location: string | null }>;
  startDate: Date;
  endDate: Date;
  requestId: string;
  origin: string;
}): Promise<boolean> {
  return deliver(params.to, {
    subject: "Fabula: ready to pick up tomorrow",
    text:
      `Hi ${params.to.name},\n\n` +
      `From tomorrow (${formatDay(params.startDate)}) you can pick up:\n` +
      `${placesBlock(params.items)}\n\n` +
      `Please return by ${formatDay(params.endDate)}.\n` +
      `\n${requestLink(params.origin, params.requestId)}`,
    push: {
      title: "Ready to pick up tomorrow",
      body: summaryLine({
        requestId: params.requestId,
        itemNames: params.items.map((item) => item.name),
        startDate: params.startDate,
        endDate: params.endDate,
        origin: params.origin,
      }),
      url: `/requests/${params.requestId}`,
      tag: `request:${params.requestId}`,
    },
  });
}

/** Il giorno stesso della scadenza. Il promemoria del giorno prima arriva
 * quando si è ancora in giro; questo arriva quando si può ancora rimediare. */
export async function sendReturnDue(params: {
  to: Recipient;
  items: Array<{ name: string; location: string | null }>;
  endDate: Date;
  requestId: string;
  origin: string;
}): Promise<boolean> {
  return deliver(params.to, {
    subject: "Fabula: due back today",
    text:
      `Hi ${params.to.name},\n\n` +
      `Today is the last day. Please bring back:\n` +
      `${placesBlock(params.items)}\n` +
      `\n${requestLink(params.origin, params.requestId)}`,
    push: {
      title: "Due back today",
      body: `${params.items.length} ${params.items.length === 1 ? "item" : "items"}`,
      url: `/requests/${params.requestId}`,
      tag: `request:${params.requestId}`,
    },
  });
}

/** A uno, tre e sette giorni di ritardo. Oltre non si insiste: vedi il
 * commento su `ReminderKind` nello schema. */
export async function sendOverdueReminder(params: {
  to: Recipient;
  items: Array<{ name: string; location: string | null }>;
  endDate: Date;
  daysLate: number;
  requestId: string;
  origin: string;
}): Promise<boolean> {
  const days = `${params.daysLate} ${params.daysLate === 1 ? "day" : "days"}`;

  return deliver(params.to, {
    subject: "Fabula: something is overdue",
    text:
      `Hi ${params.to.name},\n\n` +
      `This was due back on ${formatDay(params.endDate)}, ${days} ago:\n` +
      `${placesBlock(params.items)}\n\n` +
      `If you need it longer, or something went wrong, write in the chat — ` +
      `that is always better than silence.\n` +
      `\n${requestLink(params.origin, params.requestId)}`,
    push: {
      title: `Overdue by ${days}`,
      body: `${params.items.length} ${params.items.length === 1 ? "item" : "items"}`,
      url: `/requests/${params.requestId}`,
      tag: `request:${params.requestId}`,
    },
  });
}

/**
 * Il riassunto quotidiano dei ritardi agli admin.
 *
 * **Uno solo, con dentro tutti i ritardi**, e non uno per prestito: dieci
 * avvisi di fila sono dieci avvisi che si cestinano insieme, e il giorno in
 * cui ce n'è uno solo che conta è già stato insegnato a nessuno di guardarli.
 *
 * Qui i nomi delle persone ci sono, perché è una superficie da admin e chi
 * deve sollecitare deve sapere chi — ma solo nell'email. La notifica dice il
 * numero e basta.
 */
export async function notifyAdminsOverdueDigest(params: {
  rows: Array<{ holder: string; itemNames: string[]; endDate: Date; daysLate: number }>;
  origin: string;
}): Promise<void> {
  if (params.rows.length === 0) return;

  const { people, extras } = await adminRecipients();
  if (people.length === 0 && extras.length === 0) return;

  const subject = `Fabula: ${params.rows.length} overdue`;
  const text =
    `Still out past the return date:\n\n` +
    params.rows
      .map(
        (row) =>
          `  ${row.holder} — ${row.itemNames.join(", ")}\n` +
          `    due ${formatDay(row.endDate)}, ${row.daysLate} ${row.daysLate === 1 ? "day" : "days"} ago`
      )
      .join("\n") +
    `\n\n${params.origin}/admin?vista=ritardo`;

  await Promise.all([
    ...people.map((admin) =>
      deliver(admin, {
        subject,
        text,
        push: {
          title: "Overdue items",
          body: `${params.rows.length} ${params.rows.length === 1 ? "loan" : "loans"} past the return date`,
          url: "/admin?vista=ritardo",
          // Una `tag` fissa: il riassunto di oggi sostituisce quello di ieri
          // invece di impilarsi, che è tutto il senso di un riassunto.
          tag: "overdue-digest",
        },
      })
    ),
    ...extras.map((to) =>
      sendEmail({ to, subject, text }).catch((error) =>
        console.error(`Riassunto ritardi non consegnato a ${to}:`, error)
      )
    ),
  ]);
}
