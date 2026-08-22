/**
 * Il promemoria di riconsegna, spedito da solo.
 *
 * Non è un vero cron — non serve: un controllo ogni ora, con un guardiano
 * sul giorno già fatto, ottiene lo stesso risultato senza una dipendenza
 * in più. Parte una volta sola per processo, con lo stesso schema già in
 * uso in `db.server.ts` per il client Prisma (cache su `globalThis`,
 * altrimenti Vite lo farebbe ripartire a ogni ricarica in sviluppo).
 */

import { db } from "~/lib/db.server";
import { todayUtc } from "~/lib/availability.server";
import { sendReturnReminder } from "~/lib/notifications.server";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

declare global {
  var __reminderSchedulerStarted__: boolean | undefined;
  var __reminderLastRunDay__: string | undefined;
}

function tomorrowUtc(): Date {
  const today = todayUtc();
  return new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1)
  );
}

async function runDailySweep(): Promise<void> {
  const todayKey = todayUtc().toISOString().slice(0, 10);
  if (global.__reminderLastRunDay__ === todayKey) return;
  global.__reminderLastRunDay__ = todayKey;

  const dueRequests = await db.request.findMany({
    where: {
      status: "APPROVED",
      endDate: tomorrowUtc(),
      reminderSentAt: null,
      // Solo se c'è ancora qualcosa fuori — un ritiro fatto e non ancora
      // tornato. Una richiesta approvata ma mai ritirata non ha niente da
      // "riconsegnare" ancora.
      items: { some: { pickedUpAt: { not: null }, returnedAt: null } },
    },
    select: {
      id: true,
      endDate: true,
      user: { select: { name: true, email: true } },
      items: {
        where: { pickedUpAt: { not: null }, returnedAt: null },
        select: { asset: { select: { name: true } } },
      },
    },
  });

  for (const req of dueRequests) {
    try {
      await sendReturnReminder({
        to: req.user.email,
        name: req.user.name,
        itemNames: req.items.map((item) => item.asset.name),
        endDate: req.endDate,
      });
      await db.request.update({
        where: { id: req.id },
        data: { reminderSentAt: new Date() },
      });
    } catch (error) {
      // Una email che non parte non deve bloccare le altre richieste dovute
      // oggi — riprova domani al prossimo giro, `reminderSentAt` resta nullo.
      console.error(`Promemoria automatico fallito per la richiesta ${req.id}:`, error);
    }
  }
}

export function startReminderScheduler(): void {
  if (global.__reminderSchedulerStarted__) return;
  global.__reminderSchedulerStarted__ = true;

  void runDailySweep();
  setInterval(() => void runDailySweep(), CHECK_INTERVAL_MS);
}
