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
 * profondità 1, vedi sotto), ma perfino quello falliva.
 *
 * **Perché falliva è ancora sotto verifica.** Il sospetto principale è git
 * che rifiuta un repository il cui proprietario non combacia con chi lo
 * interroga ("dubious ownership", git 2.35+) — vedi il `Dockerfile`, dove
 * `safe.directory` prova a coprirlo — ma finché non arriva un `build`
 * diverso da `?` in produzione non è confermato. Per questo, se anche il
 * secondo tentativo qui sotto fallisce, l'errore vero finisce comunque nei
 * log di costruzione invece di sparire in silenzio: la prossima volta si sa
 * *cosa* dice git, non solo che ha fallito.
 *
 * **I due tentativi sono indipendenti, non annidati.** Prima versione: lo sha
 * corto partiva solo se `rev-list` *riusciva* e diceva `1` — se falliva del
 * tutto (qualunque motivo), il fallback non scattava mai, ed è esattamente
 * quello che è successo. Ora un fallimento del primo non impedisce il
 * secondo: se il conteggio non è disponibile o è `1` (clone superficiale,
 * dove Fabula con centinaia di commit vedrebbe comunque solo quello estratto)
 * si prova lo sha corto, che identifica il commit senza bisogno della storia
 * intera.
 */
function versionStamp() {
  let version = "?";
  try {
    version = JSON.parse(readFileSync("./package.json", "utf8")).version ?? "?";
  } catch {
    // Non può succedere, ma se succede la costruzione continua.
  }

  let lastGitError: unknown = null;
  function git(command: string): string | null {
    try {
      // Cattura anche stderr (a differenza di prima): se anche il ripiego
      // fallisce, serve a dire perché nei log di costruzione — vedi sopra.
      return execSync(command, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
    } catch (error) {
      lastGitError = error;
      return null;
    }
  }

  const count = git("git rev-list --count HEAD");
  const build = count && count !== "1" ? count : (git("git rev-parse --short HEAD") ?? "?");

  if (build === "?" && lastGitError) {
    // `console.warn` e non `throw`: la build non deve mai fallire per
    // questo, ma l'errore vero va detto, non inghiottito come prima.
    console.warn("[versionStamp] git non risponde, build resta \"?\":", lastGitError);
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
