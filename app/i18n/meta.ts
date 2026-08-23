/**
 * Il titolo di una pagina, nella lingua di chi guarda.
 *
 * Tutte e dieci le rotte restituivano `{ title: "Fabula" }`. Con dieci schede
 * aperte non se ne distingueva una, la cronologia era una colonna di «Fabula»
 * identici, i segnalibri nascevano già senza nome, e un lettore di schermo
 * annunciava lo stesso titolo a ogni cambio di pagina — cioè non annunciava
 * niente di utile.
 *
 * La lingua sta nel loader di `root`, che in `meta` si raggiunge da `matches`.
 * Il tipo dei match è volutamente largo: qui serve solo `id` e `data`.
 */

import {
  translate,
  isLang,
  type Lang,
  type TranslationKey,
} from "~/i18n/dictionaries";

// Il campo si chiama `loaderData`, non `data`: con `data` il `find` tornava
// `undefined` in silenzio e i titoli restavano tutti in inglese, senza che
// niente segnalasse l'errore.
type MetaMatchLike = { id?: string; loaderData?: unknown } | undefined;

function langOf(matches: readonly MetaMatchLike[]): Lang {
  const root = matches.find((match) => match?.id === "root")?.loaderData;
  const lang = (root as { lang?: unknown } | undefined)?.lang;
  return isLang(lang) ? lang : "en";
}

/** «Calendario · Fabula». Il nome dell'applicazione sta in fondo: il pezzo
 * che distingue una scheda dall'altra deve stare dove il browser tronca di
 * meno, cioè all'inizio. */
export function pageTitle(
  matches: readonly MetaMatchLike[],
  key: TranslationKey
): string {
  const lang = langOf(matches);
  return `${translate(lang, key)} · ${translate(lang, "app.name")}`;
}

/** La riga di descrizione della pagina, per i motori di ricerca e per
 * l'anteprima quando qualcuno incolla il collegamento in chat. */
export function tagline(matches: readonly MetaMatchLike[]): string {
  return translate(langOf(matches), "app.tagline");
}

/** Come `pageTitle`, ma con un testo già pronto (il nome di un oggetto, che
 * non si traduce). */
export function pageTitleRaw(
  matches: readonly MetaMatchLike[],
  text: string
): string {
  return `${text} · ${translate(langOf(matches), "app.name")}`;
}
