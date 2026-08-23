/**
 * Le due cose che servono a entrambe le schede di un kit — quella nuova e
 * quella da modificare — e che sarebbero copiate identiche in due file.
 */

import { db } from "~/lib/db.server";
import type { KitAssetOption } from "~/components/kit-fields";

/**
 * Tutti gli oggetti, nell'ordine del catalogo: prima per categoria, poi per
 * nome. È lo stesso ordine in cui si è imparato dove sta ogni cosa
 * sfogliando il catalogo, e quindi lo stesso in cui si cercano qui dentro.
 */
export async function assetOptions(): Promise<KitAssetOption[]> {
  const assets = await db.asset.findMany({
    where: { archivedAt: null },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      category: { select: { name: true } },
      photos: { orderBy: { sortOrder: "asc" }, take: 1, select: { thumbUrl: true } },
    },
  });

  return assets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    categoryName: asset.category?.name ?? null,
    thumbUrl: asset.photos[0]?.thumbUrl ?? null,
  }));
}

/**
 * Gli oggetti spuntati nel modulo.
 *
 * Passa da un `Set` perché un id ripetuto — nel modulo non succede, in una
 * richiesta costruita a mano sì — farebbe fallire la chiave composta di
 * `KitAsset` e trasformerebbe un salvataggio in un errore 500.
 */
export function assetIdsFrom(form: FormData): string[] {
  return [...new Set(form.getAll("assetIds").map(String).filter(Boolean))];
}

/**
 * Riscrive i pezzi di un kit.
 *
 * Cancella e riscrive invece di calcolare la differenza: `KitAsset` non ha
 * niente da conservare oltre all'ordine (nessuna data, nessuno storico —
 * quello vive sui `RequestItem`), quindi la differenza sarebbe solo codice in
 * più da sbagliare. In una transazione, così un salvataggio interrotto non
 * lascia un kit svuotato a metà.
 *
 * L'ordine è quello dell'elenco da cui si spunta, cioè quello del catalogo.
 */
export async function replaceKitAssets(kitId: string, assetIds: string[]) {
  /* Gli id arrivano dal corpo della richiesta, e da lì può arrivare
     qualunque cosa: uno che non esiste più farebbe fallire il vincolo di
     chiave esterna con un 500 invece che con un salvataggio. */
  const known = await db.asset.findMany({
    where: { id: { in: assetIds } },
    select: { id: true },
  });
  const exists = new Set(known.map((asset) => asset.id));
  const clean = assetIds.filter((id) => exists.has(id));

  await db.$transaction([
    db.kitAsset.deleteMany({ where: { kitId } }),
    db.kitAsset.createMany({
      data: clean.map((assetId, index) => ({ kitId, assetId, sortOrder: index })),
    }),
  ]);
}
