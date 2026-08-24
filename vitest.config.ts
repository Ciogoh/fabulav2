import { defineConfig } from "vitest/config";

/**
 * Configurazione minima: niente plugin di React Router né Tailwind, perché
 * qui si testano solo funzioni pure — niente rotte da costruire, niente CSS.
 *
 * `resolve.tsconfigPaths` serve per lo stesso `~/*` di `vite.config.ts`: i
 * test importano dagli stessi percorsi del resto dell'applicazione.
 *
 * `setupFiles` carica il `.env` come fa già `prisma/seed.ts`. Serve perché
 * alcuni file testati (es. `routes/admin.scan.tsx`) importano a cascata
 * `lib/db.server.ts`, che rifiuta di partire senza `DATABASE_URL` — anche se
 * il test non esegue mai una query vera.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
  },
});
