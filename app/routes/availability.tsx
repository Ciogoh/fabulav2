/**
 * «Questi oggetti sono liberi in queste date?», chiesto dal browser.
 *
 * Nasce dal difetto più costoso del flusso di richiesta: le date si
 * sceglievano alla cieca. Il dialogo non diceva niente sulla disponibilità, e
 * il conflitto arrivava come errore rosso **dopo** aver premuto «Manda la
 * richiesta» — cioè dopo aver scelto gli oggetti, aperto il foglio, compilato
 * le date e, se il periodo era lungo, anche scritto a cosa serviva.
 *
 * Rotta di sole risorse: nessun componente, solo dati. Il dialogo la
 * interroga a ogni cambio di data e segna i pezzi in conflitto sul posto.
 *
 * **Non aggiunge niente al pubblico.** Risponde con soli identificativi —
 * nessun nome di persona, nessuna richiesta, nessuna data altrui — e dice
 * esattamente quello che il catalogo mostra già coi suoi pallini e che il
 * feed iCal pubblica per costruzione.
 */

import type { Route } from "./+types/availability";
import { getBusyAssetIds, parseDay } from "~/lib/availability.server";

/** Un carrello ragionevole ne ha dieci; il tetto è contro le richieste
 * costruite a mano, non contro l'uso normale. */
const MAX_IDS = 100;

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);

  const from = parseDay(url.searchParams.get("from"));
  const to = parseDay(url.searchParams.get("to"));
  const ids = (url.searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, MAX_IDS);

  if (!from || !to || to < from || ids.length === 0) {
    return { busy: [] as string[] };
  }

  const busy = await getBusyAssetIds(from, to);

  // Solo gli identificativi chiesti: la risposta non deve diventare l'elenco
  // di tutto ciò che è occupato in magazzino.
  return { busy: ids.filter((id) => busy.has(id)) };
}
