/**
 * Il client del database, uno solo per tutta l'applicazione.
 *
 * In sviluppo Vite ricarica i moduli a ogni salvataggio: senza la cache su
 * `globalThis` ogni ricarica aprirebbe un nuovo pool di connessioni, e dopo
 * qualche minuto di lavoro PostgreSQL le rifiuterebbe.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "~/generated/prisma/client";

declare global {
  var __db__: PrismaClient | undefined;
}

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL non è impostata. Copia .env.example in .env e riempi i valori."
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

export const db = global.__db__ ?? createClient();

if (process.env.NODE_ENV !== "production") {
  global.__db__ = db;
}
