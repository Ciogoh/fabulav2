/**
 * Le categorie, la parte che serve anche al browser.
 *
 * `NEW_CATEGORY` è il valore fittizio della voce «+ Nuova categoria…» del
 * menu a tendina. Sta qui e non dentro al componente perché lo legge anche
 * l'`action` sul server: una stringa scritta a mano in due posti è una
 * stringa che prima o poi diverge, e il giorno in cui succede il modulo
 * smette di creare categorie senza dire niente.
 */

export const NEW_CATEGORY = "__new__";

/** Il nome di una categoria non è più lungo di così. */
export const MAX_CATEGORY_NAME = 40;

/**
 * Da «Audio & luci» a «audio-luci».
 *
 * Lo slug finisce nell'indirizzo del catalogo (`/?cat=audio-luci`), quindi
 * accenti e spazi devono sparire: `NFD` stacca la lettera dal suo accento e
 * il `replace` successivo butta via l'accento rimasto da solo — senza,
 * «Illuminazione» va bene ma «Attrezzatura da caffè» diventerebbe
 * «attrezzatura-da-caff-» con il segno perso per strada.
 *
 * Può tornare la stringa vuota (un nome fatto di soli emoji o di sole
 * lettere non latine): chi chiama deve avere un ripiego.
 */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, MAX_CATEGORY_NAME)
    .replace(/^-+|-+$/g, "");
}

/** Spazi di troppo via, e lunghezza al tetto. */
export function cleanCategoryName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, MAX_CATEGORY_NAME);
}
