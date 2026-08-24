/**
 * L'indirizzo corto stampato sugli adesivi: `/H/CMT3FHJSS...`.
 *
 * Non ha un'interfaccia sua — rimanda a `/admin/handover/:assetId`, dove la
 * consegna esiste già. Tenere una pagina sola vuol dire che permessi,
 * controlli di disponibilità ed email restano scritti in un posto solo; qui
 * c'è soltanto la traduzione da «cosa c'è sull'adesivo» a «dove sta la
 * pagina».
 *
 * **Il codice arriva in maiuscolo, e va rimesso in minuscolo.** L'adesivo è
 * maiuscolo apposta, per far entrare il QR nella modalità alfanumerica e
 * guadagnare un quarto di dimensione per modulo (vedi `qr.server.ts`), ma i
 * cuid nel database sono minuscoli. La conversione è esatta perché un cuid
 * contiene solo cifre e lettere senza accenti: non esiste un carattere che
 * cambiando cassa diventi ambiguo.
 *
 * Nessun `requireAdmin` qui: reindirizza e basta, e la pagina di destinazione
 * è già protetta. Metterlo anche qui vorrebbe dire mandare chi non è admin su
 * un 404 invece che sull'accesso, dopo che ha appena inquadrato un adesivo —
 * scortese e inutile, visto che dietro non c'è nessun dato da proteggere.
 */

import { redirect } from "react-router";
import type { Route } from "./+types/h.$code";

export async function loader({ params }: Route.LoaderArgs) {
  const code = params.code.toLowerCase();

  /* Solo cifre e lettere: quello che arriva qui viene da una fotocamera
     puntata su un adesivo che chiunque può aver stampato, quindi non entra
     mai grezzo in un percorso. Stessa regola del redirect filtrato. */
  if (!/^[a-z0-9]{1,64}$/.test(code)) {
    throw new Response("Not found", { status: 404 });
  }

  return redirect(`/admin/handover/${code}`);
}
