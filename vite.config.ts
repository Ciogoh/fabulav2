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
 *
 * **`SOURCE_COMMIT` non arriva mai da Coolify — verificato coi log veri del
 * 2026-09-17.** Un vecchio commento qui e nel `Dockerfile` dava per scontato
 * che Coolify lo passasse come argomento di costruzione; il comando `docker
 * build` che genera davvero non lo passa (solo le variabili configurate
 * sull'app, più `COOLIFY_URL`/`FQDN`/`BRANCH`/`RESOURCE_UUID`). Quel ramo non
 * ha mai fatto niente, ed è per questo che in produzione si leggeva sempre
 * `build ?`: il conteggio dei commit *da solo* avrebbe detto `1` (clone in
 * profondità 1, vedi sotto), ma perfino quello falliva — la vera causa era
 * `git`, non `SOURCE_COMMIT` (vedi il `Dockerfile`, "dubious ownership").
 *
 * Quindi ora: **se il conteggio è `1`, il clone è quasi certamente
 * superficiale** (Fabula ha centinaia di commit, non uno), e si usa lo sha
 * corto al suo posto — identifica comunque quale commit sta girando, anche
 * senza la storia intera per contarli. In locale, dove `.git` ha la storia
 * vera, resta il conteggio di sempre.
 */
function versionStamp() {
  let version = "?";
  try {
    version = JSON.parse(readFileSync("./package.json", "utf8")).version ?? "?";
  } catch {
    // Non può succedere, ma se succede la costruzione continua.
  }

  // Senza questo, quando git fallisce il suo errore finisce nel terminale e
  // sembra un guasto della costruzione, che invece prosegue benissimo.
  const gitStdio: Array<"ignore" | "pipe"> = ["ignore", "pipe", "ignore"];

  let build = "?";
  try {
    const count = execSync("git rev-list --count HEAD", { stdio: gitStdio }).toString().trim();
    build =
      count === "1"
        ? execSync("git rev-parse --short HEAD", { stdio: gitStdio }).toString().trim()
        : count;
  } catch {
    // Niente cartella .git (o niente git installato): `build ?`.
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
