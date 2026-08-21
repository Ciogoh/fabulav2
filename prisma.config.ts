import { defineConfig } from "prisma/config";

// Prisma 7 non legge più il .env da solo: lo carichiamo qui.
import "dotenv/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  migrations: {
    path: "prisma/migrations",
    // tsx e non `node`: il client generato da Prisma usa import senza
    // estensione, che il risolutore ESM di Node non accetta.
    seed: "tsx prisma/seed.ts",
  },
});
