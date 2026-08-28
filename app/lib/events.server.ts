/**
 * La campanella: «qualcosa è cambiato», e nient'altro.
 *
 * Serve alla chat che si aggiorna da sola (`routes/api.stream.tsx`). Il
 * principio che tiene in piedi tutto il meccanismo, e che non va rotto:
 *
 * > **Sul canale non passa mai il contenuto di niente.** Il server manda un
 * > colpetto — «la richiesta X è cambiata» — e il browser ricarica il loader
 * > che esisteva già, con `loadAuthorized` e tutti i suoi `select` scritti a
 * > mano. Nessun campo può uscire da una strada nuova, perché **non c'è una
 * > strada nuova**: c'è una campanella.
 *
 * È la ragione per cui questo file non conosce nessun modello, non fa
 * nessuna query e non sa cosa sia una richiesta: sa solo dei nomi di canale.
 *
 * ## Il limite, dichiarato
 *
 * L'emettitore vive **dentro al processo**, come il limite di frequenza
 * dell'accesso. Con un processo solo — com'è oggi — funziona. Il giorno in
 * cui i processi diventano due, un messaggio scritto sul processo A non
 * sveglia una scheda collegata al processo B: la sostituzione è
 * `LISTEN/NOTIFY` di Postgres, una ventina di righe, con questa stessa forma.
 *
 * La cache su `globalThis` è lo stesso schema di `db.server.ts` e di
 * `reminders.server.ts`: in sviluppo Vite ricarica i moduli, e senza di essa
 * nascerebbe un emettitore nuovo a ogni ricarica mentre le schede restano
 * attaccate a quello vecchio — cioè un canale che smette di suonare senza
 * dire niente.
 */

import { EventEmitter } from "node:events";

/** Massimo di flussi aperti per persona. Difende dalla scheda lasciata
 * aperta per giorni su tre computer e da chi ne apre cento a mano: sopra il
 * tetto si chiude il più vecchio, che è quello che ha meno probabilità di
 * avere ancora qualcuno davanti. */
export const MAX_STREAMS_PER_USER = 5;

type Connection = { close: () => void };

declare global {
  var __fabulaEvents__: EventEmitter | undefined;
  var __fabulaStreams__: Map<string, Connection[]> | undefined;
}

function bus(): EventEmitter {
  if (!global.__fabulaEvents__) {
    const emitter = new EventEmitter();
    // Il tetto di dieci ascoltatori di Node è una spia contro le perdite di
    // memoria, non un limite di progetto: qui ogni scheda aperta è un
    // ascoltatore legittimo, e a undici comparirebbe un avviso che non
    // significa niente.
    emitter.setMaxListeners(0);
    global.__fabulaEvents__ = emitter;
  }
  return global.__fabulaEvents__;
}

function streams(): Map<string, Connection[]> {
  if (!global.__fabulaStreams__) global.__fabulaStreams__ = new Map();
  return global.__fabulaStreams__;
}

/** Il canale di chi guarda una richiesta: chi l'ha fatta e gli admin. */
export function requestChannel(requestId: string): string {
  return `request:${requestId}`;
}

/** Il canale del Centro. Ci arriva tutto ciò che cambia il suo contenuto. */
export const ADMIN_CHANNEL = "admin";

/**
 * Qualcosa è cambiato su una richiesta: un messaggio, una decisione, un
 * ritiro, una riconsegna, le date.
 *
 * Suona **anche** al Centro: una risposta di un socio è una riga in più nella
 * sezione dei messaggi non letti, e una decisione ne toglie una dalla coda.
 */
export function publishRequestChange(requestId: string): void {
  bus().emit(requestChannel(requestId));
  bus().emit(ADMIN_CHANNEL);
}

/** È cambiato qualcosa che riguarda il Centro ma nessuna richiesta aperta:
 * una richiesta nuova, una consegna diretta. */
export function publishAdminChange(): void {
  bus().emit(ADMIN_CHANNEL);
}

/** Restituisce la funzione per staccarsi. **Va chiamata**: un ascoltatore che
 * resta attaccato a una scheda chiusa è memoria che non torna più. */
export function subscribe(channel: string, listener: () => void): () => void {
  bus().on(channel, listener);
  return () => {
    bus().off(channel, listener);
  };
}

/**
 * Registra un flusso aperto e fa rispettare il tetto per persona.
 *
 * Restituisce la funzione da chiamare alla chiusura — che **non** richiude la
 * connessione, la dimentica e basta: a chiuderla è chi l'ha aperta.
 */
export function trackStream(userId: string, connection: Connection): () => void {
  const open = streams().get(userId) ?? [];
  open.push(connection);

  while (open.length > MAX_STREAMS_PER_USER) {
    open.shift()?.close();
  }
  streams().set(userId, open);

  return () => {
    const rest = (streams().get(userId) ?? []).filter((c) => c !== connection);
    if (rest.length === 0) streams().delete(userId);
    else streams().set(userId, rest);
  };
}
