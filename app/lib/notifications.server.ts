/**
 * Tutte le email legate al ciclo di vita di una richiesta, in un posto
 * solo — prima erano scritte a mano dentro le singole action, e il
 * promemoria di riconsegna in particolare serve identico sia al bottone
 * manuale sia allo spazzatore automatico (`reminders.server.ts`).
 *
 * Restano tutte in inglese, non tradotte per lingua del destinatario:
 * è già così per ogni email di Fabula (codice OTP, reset password), quindi
 * le nuove seguono lo stesso schema invece di inventarne uno a parte.
 *
 * Ogni funzione qui dentro si limita a costruire il testo e mandarlo — se
 * l'invio fallisce, l'errore risale a chi chiama, che decide se loggare e
 * proseguire o segnalarlo a chi ha premuto il bottone. Nessuna di queste
 * email deve mai far fallire l'azione che l'ha innescata: chi ha scritto
 * una nota, approvato una richiesta o annullato un prestito ha comunque
 * fatto quello che voleva, a prescindere da un SMTP che non risponde.
 */

import { formatDay } from "~/lib/availability.server";
import { adminEmails, sendEmail } from "~/lib/email.server";

type RequestSummary = {
  requestId: string;
  itemNames: string[];
  startDate: Date;
  endDate: Date;
  origin: string;
};

function requestLink(origin: string, requestId: string): string {
  return `${origin}/requests/${requestId}`;
}

export async function notifyAdminsNewRequest(
  params: RequestSummary & {
    requesterName: string;
    requesterEmail: string;
    purpose: string | null;
  }
): Promise<void> {
  const admins = adminEmails();
  if (admins.length === 0) return;

  const text =
    `${params.requesterName} (${params.requesterEmail}) requested: ${params.itemNames.join(", ")}\n` +
    `From ${formatDay(params.startDate)} to ${formatDay(params.endDate)}.\n` +
    (params.purpose ? `Reason: ${params.purpose}\n` : "") +
    `\n${requestLink(params.origin, params.requestId)}`;

  await Promise.all(
    admins.map((to) =>
      sendEmail({ to, subject: `Fabula: new request from ${params.requesterName}`, text })
    )
  );
}

export async function notifyRequesterDecision(
  params: RequestSummary & {
    to: string;
    name: string;
    decision: "approved" | "rejected";
  }
): Promise<void> {
  const approved = params.decision === "approved";
  const text =
    `Hi ${params.name},\n\n` +
    `Your request for ${params.itemNames.join(", ")} ` +
    `(from ${formatDay(params.startDate)} to ${formatDay(params.endDate)}) ` +
    (approved ? "has been approved.\n" : "has not been approved.\n") +
    `\n${requestLink(params.origin, params.requestId)}`;

  await sendEmail({
    to: params.to,
    subject: approved ? "Fabula: request approved" : "Fabula: request not approved",
    text,
  });
}

export async function notifyRequesterCancelled(
  params: RequestSummary & { to: string; name: string }
): Promise<void> {
  const text =
    `Hi ${params.name},\n\n` +
    `An admin has cancelled your request for ${params.itemNames.join(", ")} ` +
    `(from ${formatDay(params.startDate)} to ${formatDay(params.endDate)}). ` +
    `If you think this is a mistake, write in the request's chat.\n` +
    `\n${requestLink(params.origin, params.requestId)}`;

  await sendEmail({ to: params.to, subject: "Fabula: request cancelled", text });
}

export async function sendReturnReminder(params: {
  to: string;
  name: string;
  itemNames: string[];
  endDate: Date;
}): Promise<void> {
  const text =
    `Hi ${params.name},\n\n` +
    `A reminder: please return by ${formatDay(params.endDate)}:\n` +
    `${params.itemNames.join(", ")}\n`;

  await sendEmail({ to: params.to, subject: "Fabula: return reminder", text });
}
