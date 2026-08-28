-- I promemoria diventano quattro, e un timestamp solo non basta più a dire
-- quale sia già partito.
--
-- **L'ordine delle istruzioni qui sotto è la parte che conta.** Il diff
-- generato da Prisma toglie `reminderSentAt` *prima* di creare la tabella
-- nuova, e a quel punto non c'è più niente da travasare: chi ha già ricevuto
-- il promemoria di riconsegna lo riceverebbe di nuovo il giorno del rilascio.
-- Quindi: prima si crea, poi si travasa, e solo alla fine si lascia andare la
-- colonna vecchia.

-- CreateEnum
CREATE TYPE "ReminderKind" AS ENUM ('PICKUP', 'RETURN_SOON', 'RETURN_DUE', 'OVERDUE');

-- CreateTable
CREATE TABLE "ReminderLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "kind" "ReminderKind" NOT NULL,
    "dayKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReminderLog_requestId_idx" ON "ReminderLog"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderLog_requestId_kind_dayKey_key" ON "ReminderLog"("requestId", "kind", "dayKey");

-- AddForeignKey
ALTER TABLE "ReminderLog" ADD CONSTRAINT "ReminderLog_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Il travaso. L'unico promemoria che esisteva prima era quello di riconsegna
-- del giorno prima, cioè `RETURN_SOON`.
INSERT INTO "ReminderLog" ("id", "requestId", "kind", "dayKey", "sentAt")
SELECT gen_random_uuid()::text,
       "id",
       'RETURN_SOON',
       to_char("reminderSentAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
       "reminderSentAt"
FROM "Request"
WHERE "reminderSentAt" IS NOT NULL;

-- AlterTable
ALTER TABLE "Request" DROP COLUMN "reminderSentAt";
