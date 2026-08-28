/**
 * Il canale che tiene aggiornata una pagina senza ricaricarla.
 *
 * Server-Sent Events: una connessione HTTP che il server tiene aperta e su
 * cui manda righe di testo. È **unidirezionale**, che è esattamente ciò che
 * serve — il browser scrive già con i moduli — e passa da Cloudflare e da
 * Traefik senza configurazione. Un WebSocket sarebbe bidirezionale, cioè
 * metà funzione in più che qui non serve, e `react-router-serve` non lo
 * espone: bisognerebbe sostituire il server con un Express scritto a mano.
 *
 * **Quello che viaggia qui dentro è un colpetto, non un contenuto.** Vedi il
 * blocco in cima a `lib/events.server.ts`: il browser risponde ricaricando il
 * loader che esisteva già, con le sue autorizzazioni e i suoi `select`. È
 * anche il motivo per cui questa rotta non ha bisogno di scegliere campi:
 * non ne manda nessuno.
 *
 * Due cose che sembrano dettagli e non lo sono:
 *
 * - **Il battito ogni 25 secondi.** Senza, un proxy che chiude le connessioni
 *   inattive a trenta o sessanta secondi taglia il canale, il browser passa
 *   al ripiego e nessuno capisce perché. La riga che comincia per `:` è un
 *   commento del protocollo: arriva, tiene viva la connessione, non innesca
 *   niente.
 * - **La pulizia sull'`abort`.** Se manca, ogni scheda chiusa lascia un
 *   ascoltatore attaccato all'emettitore e un intervallo acceso: la memoria
 *   del processo sale e non scende mai più. È l'errore classico di questo
 *   schema, e non si vede finché il server non è su da una settimana.
 */

import type { Route } from "./+types/api.stream";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/session.server";
import {
  ADMIN_CHANNEL,
  requestChannel,
  subscribe,
  trackStream,
} from "~/lib/events.server";

/** Sotto ai trenta secondi, che è il timeout più corto che si incontra in
 * giro fra proxy e reti mobili. */
const HEARTBEAT_MS = 25_000;

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const requestId = new URL(request.url).searchParams.get("request");

  let channel: string;

  if (requestId) {
    /* **La stessa autorizzazione del dettaglio**, e non «tanto l'id è
       difficile da indovinare»: chi non è né il proprietario né un admin
       riceve 404, come ovunque nel pannello — così l'indirizzo non risulta
       nemmeno esistere. */
    const target = await db.request.findUnique({
      where: { id: requestId },
      select: { userId: true },
    });
    if (!target) throw new Response("Not found", { status: 404 });
    if (target.userId !== user.id && user.role !== "ADMIN") {
      throw new Response("Not found", { status: 404 });
    }
    channel = requestChannel(requestId);
  } else {
    // Senza `?request=`, è il canale del Centro: solo admin.
    if (user.role !== "ADMIN") throw new Response("Not found", { status: 404 });
    channel = ADMIN_CHANNEL;
  }

  const encoder = new TextEncoder();

  // `Uint8Array<ArrayBuffer>` e non `Uint8Array` nudo: senza il parametro,
  // TypeScript considera anche il caso `SharedArrayBuffer`, che `Response`
  // non accetta come corpo.
  const stream = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      let unsubscribe = () => {};
      let untrack = () => {};

      function close() {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe();
        untrack();
        request.signal.removeEventListener("abort", close);
        try {
          controller.close();
        } catch {
          // Già chiusa dall'altra parte: va bene così.
        }
      }

      function send(chunk: string) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Chi ascoltava se n'è andato senza che l'`abort` sia ancora
          // arrivato: si chiude qui, o l'ascoltatore resta attaccato.
          close();
        }
      }

      // Subito qualcosa, o `onopen` nel browser può tardare finché non
      // arriva il primo byte — e nel frattempo sembra che non funzioni.
      send(": open\n\n");

      unsubscribe = subscribe(channel, () => send("event: change\ndata: 1\n\n"));
      heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);
      untrack = trackStream(user.id, { close });

      request.signal.addEventListener("abort", close);
      if (request.signal.aborted) close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      // `no-transform` insieme a `no-cache`: senza, un proxy che comprime al
      // volo può accumulare i pezzi e consegnarli a blocchi, che per un
      // flusso vuol dire notizie in ritardo di minuti.
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Per i proxy che bufferizzano di serie (nginx e parenti). Traefik non
      // ne ha bisogno, ma l'intestazione non fa danni e la produzione può
      // cambiare senza che nessuno si ricordi di questa riga.
      "X-Accel-Buffering": "no",
    },
  });
}
