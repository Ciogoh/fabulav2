/**
 * Le iniziali di un nome, per i segnaposto.
 *
 * Stava scritta tre volte — nel catalogo, nella scheda oggetto e ora nelle
 * avatar — con tre varianti leggermente diverse. È una funzione pura di sei
 * righe: sta qui, e chi la usa la importa.
 */

/** «Cassa attiva RCF» → «CA». «Mario Rossi» → «MR». */
export function initialsOf(text: string): string {
  return text
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}
