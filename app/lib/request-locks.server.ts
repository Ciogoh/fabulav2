/** Ogni scrittura di una prenotazione usa lo stesso ordine di blocco dei pezzi. */
import { Prisma } from "~/generated/prisma/client";
export async function lockAssets(tx: Prisma.TransactionClient, ids: string[]) {
  const sorted = [...new Set(ids)].sort();
  if (sorted.length)
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Asset" WHERE "id" IN (${Prisma.join(sorted)}) ORDER BY "id" FOR UPDATE`,
    );
}
