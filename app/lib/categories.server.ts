/**
 * Creare una categoria senza uscire dalla scheda di un oggetto.
 *
 * La categoria giusta viene in mente mentre si sta inserendo l'oggetto, non
 * prima: costringere a salvare a metà, andare in un'altra pagina, crearla e
 * tornare indietro è il modo più sicuro per ritrovarsi un magazzino intero
 * senza categorie. Per questo il menu a tendina ha in fondo «+ Nuova
 * categoria…», e la creazione avviene nello stesso salvataggio dell'oggetto.
 */

import { db } from "~/lib/db.server";
import { cleanCategoryName, slugify, NEW_CATEGORY } from "~/lib/categories";
import type { TranslationKey } from "~/i18n/dictionaries";

export type CategoryChoice =
  | { ok: true; categoryId: string | null }
  | { ok: false; error: TranslationKey };

/**
 * La categoria con questo nome, creandola se non c'è.
 *
 * **Cerca per slug, non per nome**: «Audio» e «audio » devono finire nella
 * stessa categoria, altrimenti il filtro del catalogo si riempie di doppioni
 * che a occhio sono identici.
 */
export async function findOrCreateCategory(rawName: string): Promise<string | null> {
  const name = cleanCategoryName(rawName);
  if (name.length < 2) return null;

  // Il ripiego serve ai nomi da cui non si ricava nessuna lettera latina:
  // lo slug deve esistere comunque, perché è unico e sta nell'indirizzo.
  const slug = slugify(name) || `cat-${Date.now().toString(36)}`;

  const existing = await db.category.findUnique({ where: { slug }, select: { id: true } });
  if (existing) return existing.id;

  const last = await db.category.aggregate({ _max: { sortOrder: true } });

  try {
    const created = await db.category.create({
      data: { name, slug, sortOrder: (last._max.sortOrder ?? -1) + 1 },
      select: { id: true },
    });
    return created.id;
  } catch (error) {
    // Due admin che salvano «Audio» nello stesso istante: il secondo sbatte
    // contro l'unicità dello slug. Non è un errore da mostrare — la categoria
    // che voleva adesso esiste, basta usare quella.
    const raced = await db.category.findUnique({ where: { slug }, select: { id: true } });
    if (raced) return raced.id;
    throw error;
  }
}

/**
 * Che categoria ha scelto il modulo: una che c'era, una da creare al volo, o
 * nessuna.
 *
 * Se si sceglie «+ Nuova categoria…» e poi si lascia il campo vuoto,
 * l'oggetto **non** si salva in silenzio senza categoria: chi ha aperto quel
 * campo la voleva, e trovarla sparita al ritorno sembra un difetto.
 */
export async function categoryFromForm(form: FormData): Promise<CategoryChoice> {
  const choice = String(form.get("categoryId") ?? "");

  if (choice !== NEW_CATEGORY) {
    return { ok: true, categoryId: choice || null };
  }

  const categoryId = await findOrCreateCategory(String(form.get("newCategory") ?? ""));
  if (!categoryId) {
    return { ok: false, error: "assets.errorCategoryName" as TranslationKey };
  }
  return { ok: true, categoryId };
}
