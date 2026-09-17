import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

/**
 * I tre valori della riga di versione, letti una volta sola qui e incollati
 * nel codice come stringhe letterali (vedi `app/lib/version.ts`).
 *
 * Ognuno ha il suo ripiego, e non è pignoleria: **la costruzione non deve mai
 * fallire per colpa del numero di versione**. È decorazione, non una
 * funzione.
 *
 * **In produzione su Coolify `git` non funziona mai, e non è aggiustabile da
 * qui.** Tre correzioni diverse (2026-09-17: ownership, poi la struttura del
 * fallback) hanno dato per scontate cause sempre più specifiche, finché un
 * log di build letto crudo non ha mostrato la verità:
 * `ls: .git: No such file or directory`. La cartella non arriva proprio nel
 * contesto — non `.dockerignore` (non la esclude), non git stesso (il clone
 * di Coolify funziona, lo si vede dal commit letto subito dopo) — a monte
 * Coolify assembla il contesto di build senza `.git`, prima ancora che
 * Docker entri in gioco. Nessuna riga di `Dockerfile` può recuperarla.
 *
 * Quindi: **il conteggio dei commit resta un extra per lo sviluppo locale**
 * (dove `.git` c'è davvero, con la storia intera) **e non il meccanismo
 * principale.** Il ripiego di sempre — sempre disponibile, ovunque, senza
 * bisogno di git — è l'istante della build stessa: non sale con ogni commit,
 * ma è comunque un'impronta che risponde alla domanda vera, «quale copia sta
 * girando», ed è quella che conta quando l'altra non è disponibile.
 */
function versionStamp() {
  let version = "?";
  try {
    version = JSON.parse(readFileSync("./package.json", "utf8")).version ?? "?";
  } catch {
    // Non può succedere, ma se succede la costruzione continua.
  }

  let count: string | null = null;
  try {
    count = execSync("git rev-list --count HEAD", {
      // Senza questo, quando git fallisce il suo errore finisce nel terminale
      // e sembra un guasto della costruzione, che invece prosegue benissimo.
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    // Niente `.git` (sempre così su Coolify) o niente git installato.
  }

  // Base36 e non un ISO leggibile: la data per esteso c'è già in
  // `__BUILD_DATE__`, ripeterla qui nella stessa riga sarebbe ridondante —
  // questo è solo un'impronta, non ha bisogno di dirsi da solo cos'è.
  const build = count && count !== "1" ? count : Date.now().toString(36);

  return {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_NUMBER__: JSON.stringify(build),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  };
}

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  define: versionStamp(),
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    allowedHosts: [
      ".fabulabz.com",
      "visual1.fabulabz.com",
      "visual.fabulabz.com",
      "try.fabulabz.com",
      "tryy.fabulabz.com",
      "fabulabz.com",
      ".trycloudflare.com",
      "localhost",
    ],
    // Senza questo, Vite ascolta solo su `localhost`, che su alcuni Mac si
    // risolve **solo** in IPv6 (`::1`): il browser che prova `127.0.0.1`
    // trova la porta chiusa anche col server sano. `0.0.0.0` ascolta su
    // tutte le interfacce IPv4, quindi `localhost` funziona qualunque
    // indirizzo il sistema decida di usare per primo.
    host: "0.0.0.0",
  },
});
