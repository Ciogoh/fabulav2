/**
 * «Che cosa aspetta me?» — le domande del Centro, in un posto solo.
 *
 * Stanno qui e non dentro alla rotta perché due delle tre servono anche al
 * loader radice, che gira a **ogni** pagina per disegnare la pastiglia
 * nell'intestazione: se vivessero nella rotta andrebbero riscritte, e due
 * copie della stessa domanda prima o poi rispondono in modo diverso.
 *
 * ## Perché qui c'è dell'SQL, che altrove non c'è
 *
 * «Un messaggio non letto» vuol dire *l'ultimo messaggio di chi ha chiesto è
 * più recente del segnalibro di chi guarda*, cioè il confronto fra una
 * colonna di `Message` e una colonna di `Request`. Prisma sa confrontare due
 * campi **dello stesso modello**, non di due modelli diversi.
 *
 * Le due alternative sono peggiori, ognuna a modo suo:
 *
 * - **Tenere su `Request` una copia della data dell'ultimo messaggio.**
 *   Renderebbe la domanda esprimibile in Prisma, ma introdurrebbe un campo
 *   che ripete un dato che vive già altrove — esattamente ciò che la regola
 *   1 vieta («gli stati non si salvano mai»): un valore così può andare fuori
 *   sincrono, e il giorno che succede nessuno se ne accorge.
 * - **Portarsi in memoria tutte le richieste con la loro ultima riga di chat**
 *   e contarle in JavaScript. Funziona finché le richieste sono cento.
 *
 * Quindi SQL, che è quello che `CLAUDE.md` prevede per questo caso: con
 * `Prisma.sql`, **senza nessun valore che arrivi da fuori** — qui non ce n'è
 * proprio, la query è fissa — e restituendo soltanto degli **id**. I campi si
 * scelgono dopo, con i `select` scritti a mano di sempre: nessuna colonna può
 * uscire da questa porta.
 */

import { Prisma } from "~/generated/prisma/client";
import { db } from "~/lib/db.server";
import { todayUtc } from "~/lib/availability.server";

/**
 * Le richieste in cui **chi ha chiesto** ha scritto dopo l'ultimo passaggio di
 * un admin. Il verso opposto — l'admin ha risposto e il socio non l'ha ancora
 * letto — è `unreadForUser`.
 *
 * Si contano le **richieste** e non i messaggi: il numero sulla pastiglia deve
 * dire quante cose ci sono da aprire, non quante righe sono state scritte.
 */
export async function unreadForAdminIds(): Promise<string[]> {
  const rows = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT r."id"
    FROM "Request" r
    WHERE EXISTS (
      SELECT 1
      FROM "Message" m
      JOIN "User" u ON u."id" = m."authorId"
      WHERE m."requestId" = r."id"
        AND u."role" <> 'ADMIN'
        AND (r."adminSeenAt" IS NULL OR m."createdAt" > r."adminSeenAt")
    )
    ORDER BY r."updatedAt" DESC
  `);
  return rows.map((row) => row.id);
}

/** Lo specchio, per chi ha fatto la richiesta: un admin ha scritto e lui non
 * l'ha ancora letto. Oggi chi chiede in prestito non ha nessun segnale che
 * qualcuno gli abbia risposto, ed è lo stesso difetto visto dall'altra parte. */
export async function unreadForUserIds(userId: string): Promise<string[]> {
  const rows = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT r."id"
    FROM "Request" r
    WHERE r."userId" = ${userId}
      AND EXISTS (
        SELECT 1
        FROM "Message" m
        JOIN "User" u ON u."id" = m."authorId"
        WHERE m."requestId" = r."id"
          AND u."role" = 'ADMIN'
          AND (r."userSeenAt" IS NULL OR m."createdAt" > r."userSeenAt")
      )
  `);
  return rows.map((row) => row.id);
}

/**
 * I tre numeri della pastiglia, in **due** interrogazioni.
 *
 * Il loader radice gira a ogni pagina: oggi ne fa due e deve continuare a
 * farne due, o il conto lo paga chiunque apra il catalogo. Attesa e non letti
 * viaggiano insieme perché entrambi guardano `Request`; i ritardi no, perché
 * quelli si contano sugli oggetti (regola 2: una riconsegna parziale può
 * lasciarne in ritardo solo alcuni).
 */
export async function adminCounts(): Promise<{
  pending: number;
  unread: number;
  overdue: number;
}> {
  const [totals, overdue] = await Promise.all([
    db.$queryRaw<Array<{ pending: bigint; unread: bigint }>>(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE r."status" = 'PENDING') AS pending,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1
          FROM "Message" m
          JOIN "User" u ON u."id" = m."authorId"
          WHERE m."requestId" = r."id"
            AND u."role" <> 'ADMIN'
            AND (r."adminSeenAt" IS NULL OR m."createdAt" > r."adminSeenAt")
        )) AS unread
      FROM "Request" r
    `),
    // Un oggetto è in ritardo quando è stato ritirato, non è ancora tornato e
    // il periodo è già finito. Gli archiviati restano fuori: sono già stati
    // scritti come persi, non c'è più niente da sollecitare.
    db.requestItem.count({
      where: {
        pickedUpAt: { not: null },
        returnedAt: null,
        asset: { archivedAt: null },
        request: { status: "APPROVED", endDate: { lt: todayUtc() } },
      },
    }),
  ]);

  const row = totals[0];
  return {
    // `COUNT` in Postgres è un `bigint`, che arriva qui come `BigInt` e non
    // sopravvive a `JSON.stringify`: senza questa conversione il loader
    // fallisce con «Do not know how to serialize a BigInt».
    pending: Number(row?.pending ?? 0),
    unread: Number(row?.unread ?? 0),
    overdue,
  };
}
