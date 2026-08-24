/**
 * Chi è questa copia di Fabula.
 *
 * Tre valori che fanno mestieri diversi, ed è tutta la ragione per cui sono
 * tre e non uno:
 *
 * - `APP_VERSION` risponde a **«quanto è cresciuta?»**. È un giudizio, deciso
 *   a mano in `package.json` quando un pezzo di lavoro finisce, e raccontato
 *   per esteso nel `CHANGELOG.md`. La 1.0.0 è il giorno della consegna ai
 *   soci.
 * - `BUILD_NUMBER` risponde a **«cosa sta girando davvero?»**. È il conteggio
 *   dei commit: sale da solo, non lo mantiene nessuno, e sale anche per un
 *   refuso — è un'impronta digitale, non una misura di merito.
 * - `BUILD_DATE` dice quando questa copia è stata costruita, che è la domanda
 *   vera dietro a «ma il server ha già la correzione?».
 *
 * I valori arrivano dal `define` di `vite.config.ts` e sono già stringhe
 * letterali quando il codice gira: qui non si legge niente, non si chiama
 * niente, non può fallire.
 */

export const APP_VERSION = __APP_VERSION__;
export const BUILD_NUMBER = __BUILD_NUMBER__;
export const BUILD_DATE = __BUILD_DATE__;

/**
 * La riga come si legge a schermo: `Fabula 0.5.0 · build 27 · 2026-08-24`.
 *
 * Senza etichetta di proposito — «Versione:» andrebbe tradotto in tre lingue
 * per non dire niente in più.
 */
export function versionLabel(): string {
  return `Fabula ${APP_VERSION} · build ${BUILD_NUMBER} · ${BUILD_DATE}`;
}
