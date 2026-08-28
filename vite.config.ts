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
 * funzione — se git non risponde si legge `build ?` e si va avanti.
 *
 * Perché `git` funziona anche dentro al container: `.dockerignore` non
 * esclude più `.git` (pesa 2,3 MB su un contesto di 5,7) e il `Dockerfile`
 * installa `git` nello stadio di costruzione, che viene poi buttato via.
 * Prima si passava tutto come argomento di costruzione, cioè un gesto da
 * ricordare a ogni rilascio — ed è il genere di gesto che si dimentica.
 */
function versionStamp() {
  let version = "?";
  try {
    version = JSON.parse(readFileSync("./package.json", "utf8")).version ?? "?";
  } catch {
    // Non può succedere, ma se succede la costruzione continua.
  }

  // Lo sha passato da chi costruisce vince sul conteggio dei commit.
  //
  // Coolify clona in profondità 1 e passa `SOURCE_COMMIT` come argomento di
  // costruzione (vedi il `Dockerfile`). Lì il conteggio direbbe `1` **senza
  // fallire**, quindi il `catch` qui sotto non se ne accorgerebbe mai, e la
  // riga di versione mostrerebbe `build 1` per sempre. In locale la variabile
  // è vuota, `.git` c'è davvero e il conteggio resta quello di prima.
  let build = process.env.SOURCE_COMMIT?.slice(0, 7) || "?";

  if (build === "?") {
    try {
      build = execSync("git rev-list --count HEAD", {
        // Senza questo, quando git fallisce il suo errore finisce nel
        // terminale e sembra un guasto della costruzione, che invece prosegue
        // benissimo.
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim();
    } catch {
      // Niente cartella .git (o niente git installato): `build ?`.
    }
  }

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
    // Vite rifiuta di serie ogni `Host` che non sia localhost, contro il
    // DNS rebinding — e per lo stesso motivo blocca anche il tunnel
    // Cloudflare, che in sviluppo passa da qui.
    allowedHosts: ["try.fabulabz.com"],
    // Senza questo, Vite ascolta solo su `localhost`, che su alcuni Mac si
    // risolve **solo** in IPv6 (`::1`): il browser che prova `127.0.0.1`
    // trova la porta chiusa anche col server sano. `0.0.0.0` ascolta su
    // tutte le interfacce IPv4, quindi `localhost` funziona qualunque
    // indirizzo il sistema decida di usare per primo.
    host: "0.0.0.0",
  },
});
