/**
 * «Sei viva?», chiesto da chi tiene su la piattaforma.
 *
 * La interroga Coolify a intervalli regolari: finché risponde `200` il
 * container nuovo prende il traffico, e appena smette la versione precedente
 * resta su e parte la notifica. Il tunnel Cloudflare la usa per lo stesso
 * motivo.
 *
 * **Interroga davvero il database**, e non è pignoleria: un processo Node
 * vivo con il database irraggiungibile è esattamente il guasto che un
 * controllo «risponde alla porta 3000» non vede, e che per chi usa la
 * piattaforma è indistinguibile da tutto spento.
 *
 * Rotta di sole risorse, senza componente: nessun dato, nessun rendering,
 * nessuna sessione da leggere. È pubblica perché deve esserlo — chi controlla
 * la salute non ha un account — e non rivela niente: due parole e un numero.
 */

import { db } from "~/lib/db.server";

export async function loader() {
  try {
    // `SELECT 1` e non un conteggio su una tabella nostra: costa niente,
    // non tocca lo schema, e continua a valere se un giorno le tabelle
    // cambiano nome.
    await db.$queryRaw`SELECT 1`;
  } catch {
    // Il perché non esce di qui: finirebbe in una risposta pubblica, e un
    // messaggio di Postgres racconta più di quanto serva sapere a chi
    // chiede. Nei log del container c'è già tutto.
    return new Response("database unreachable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return new Response("ok", {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
