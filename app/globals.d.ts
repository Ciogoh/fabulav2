/**
 * I valori che `vite.config.ts` incolla nel codice al momento della
 * costruzione (vedi il suo `define`). Non esistono a runtime come variabili:
 * quando il codice gira sono già diventati stringhe letterali.
 */

/** La versione decisa a mano in `package.json`, tipo "0.5.0". */
declare const __APP_VERSION__: string;
/** Il numero di commit, tipo "27". Sale da solo a ogni commit. */
declare const __BUILD_NUMBER__: string;
/** Il giorno in cui questa copia è stata costruita, tipo "2026-08-24". */
declare const __BUILD_DATE__: string;
