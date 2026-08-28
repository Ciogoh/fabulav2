/**
 * Il token del calendario personale: una credenziale, non un id.
 *
 * Chi ce l'ha vede i prestiti di quella persona — posizioni comprese — senza
 * fare l'accesso: è così che funziona un indirizzo iCal, che i programmi di
 * calendario scaricano da soli. Per questo si genera con `randomBytes` e non
 * si deriva da `User.id`, che è prevedibile.
 */

import { randomBytes } from "node:crypto";
import { db } from "~/lib/db.server";

function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Creato pigramente alla prima apertura della sezione nel profilo. */
export async function getOrCreateCalendarToken(userId: string): Promise<string> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { calendarToken: true },
  });
  if (user.calendarToken) return user.calendarToken;

  const token = generateToken();
  await db.user.update({ where: { id: userId }, data: { calendarToken: token } });
  return token;
}

/**
 * Il collegamento vecchio smette di funzionare nello stesso istante in cui ne
 * nasce uno nuovo: non c'è una finestra in cui nessuno dei due è valido, e
 * nemmeno una in cui sono validi entrambi.
 */
export async function regenerateCalendarToken(userId: string): Promise<string> {
  const token = generateToken();
  await db.user.update({ where: { id: userId }, data: { calendarToken: token } });
  return token;
}
