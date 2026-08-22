/**
 * Tutte le email legate al ciclo di vita di una richiesta, in un posto
 * solo — prima erano scritte a mano dentro le singole action, e il
 * promemoria di riconsegna in particolare serve identico sia al bottone
 * manuale sia allo spazzatore automatico (`reminders.server.ts`).
 *
 * Restano tutte in italiano, non tradotte per lingua del destinatario:
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
    `${params.requesterName} (${params.requesterEmail}) ha richiesto: ${params.itemNames.join(", ")}\n` +
    `Dal ${formatDay(params.startDate)} al ${formatDay(params.endDate)}.\n` +
    (params.purpose ? `Motivo: ${params.purpose}\n` : "") +
    `\n${requestLink(params.origin, params.requestId)}`;

  await Promise.all(
    admins.map((to) =>
      sendEmail({ to, subject: `Fabula: nuova richiesta da ${params.requesterName}`, text })
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
    `Ciao ${params.name},\n\n` +
    `La tua richiesta per ${params.itemNames.join(", ")} ` +
    `(dal ${formatDay(params.startDate)} al ${formatDay(params.endDate)}) ` +
    (approved ? "è stata approvata.\n" : "non è stata approvata.\n") +
    `\n${requestLink(params.origin, params.requestId)}`;

  await sendEmail({
    to: params.to,
    subject: approved ? "Fabula: richiesta approvata" : "Fabula: richiesta non approvata",
    text,
  });
}

export async function notifyRequesterCancelled(
  params: RequestSummary & { to: string; name: string }
): Promise<void> {
  const text =
    `Ciao ${params.name},\n\n` +
    `Un admin ha annullato la tua richiesta per ${params.itemNames.join(", ")} ` +
    `(dal ${formatDay(params.startDate)} al ${formatDay(params.endDate)}). ` +
    `Se pensi sia un errore, scrivi in chat sulla richiesta.\n` +
    `\n${requestLink(params.origin, params.requestId)}`;

  await sendEmail({ to: params.to, subject: "Fabula: richiesta annullata", text });
}

export async function sendReturnReminder(params: {
  to: string;
  name: string;
  itemNames: string[];
  endDate: Date;
}): Promise<void> {
  const text =
    `Ciao ${params.name},\n\n` +
    `Un promemoria: ricordati di riportare entro il ${formatDay(params.endDate)}:\n` +
    `${params.itemNames.join(", ")}\n`;

  await sendEmail({ to: params.to, subject: "Fabula: promemoria riconsegna", text });
}
