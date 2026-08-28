/**
 * «Questa pagina si aggiorna da sola.»
 *
 * Apre il canale di `routes/api.stream.tsx` e, a ogni colpetto, chiede a
 * React Router di **ricaricare il loader**. Non tocca lo stato della pagina e
 * non sa cosa contenga: tutto quello che arriva a schermo è passato dal
 * loader di sempre, con le sue autorizzazioni.
 *
 * Tre comportamenti che decidono se la cosa è utile o fastidiosa:
 *
 * - **Si apre solo a scheda visibile.** Una lasciata aperta in fondo alla
 *   finestra da tre giorni non deve tenere una connessione occupata, e
 *   ricaricare una pagina che nessuno guarda è lavoro buttato. Tornando in
 *   primo piano si riapre e si ricarica subito: quello è il momento in cui
 *   può essere cambiato qualcosa mentre non si guardava.
 * - **Dopo tre errori di fila smette e passa al sondaggio.** Ci sono reti e
 *   proxy che alle connessioni lunghe non lasciano scampo; lì un canale che
 *   si riapre in continuazione è peggio di un giro ogni quindici secondi.
 *   Senza questo ripiego la funzione sarebbe «di solito funziona», che per un
 *   messaggio che si aspetta non basta.
 * - **Non ricarica mentre una ricarica è già in corso**, o due colpetti
 *   ravvicinati — che è il caso normale: un messaggio scritto suona sia sul
 *   canale della richiesta sia su quello del Centro — ne accodano due.
 */

import { useEffect, useRef } from "react";
import { useRevalidator } from "react-router";

/** Quanti errori di fila prima di rinunciare al canale. */
const MAX_FAILURES = 3;
/** Ogni quanto si guarda, quando il canale non si può usare. */
const POLL_MS = 15_000;

export function useLive(url: string | null): void {
  const revalidator = useRevalidator();

  /* `useRevalidator` restituisce un oggetto nuovo a ogni disegno: metterlo
     fra le dipendenze dell'effetto farebbe chiudere e riaprire la
     connessione a ogni ricarica, cioè proprio a ogni colpetto ricevuto. */
  const refreshRef = useRef(revalidator.revalidate);
  refreshRef.current = revalidator.revalidate;
  const busyRef = useRef(revalidator.state !== "idle");
  busyRef.current = revalidator.state !== "idle";

  useEffect(() => {
    if (!url) return;

    let source: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let failures = 0;
    let stopped = false;

    function refresh() {
      if (document.visibilityState !== "visible") return;
      if (busyRef.current) return;
      void refreshRef.current();
    }

    function closeChannel() {
      source?.close();
      source = null;
      if (poll) clearInterval(poll);
      poll = null;
    }

    function startPolling() {
      if (poll) return;
      poll = setInterval(refresh, POLL_MS);
    }

    function open() {
      if (stopped || source || poll) return;
      if (failures >= MAX_FAILURES) return startPolling();

      const channel = new EventSource(url!);
      source = channel;

      channel.addEventListener("open", () => {
        // Una connessione riuscita azzera il conto: gli errori che contano
        // sono quelli **di fila**, non quelli di sempre.
        failures = 0;
      });
      channel.addEventListener("change", refresh);
      channel.addEventListener("error", () => {
        // `EventSource` riprova da solo, ma se il canale è impraticabile
        // riprova per sempre. Qui si conta, e a tre si cambia strada.
        failures += 1;
        if (failures < MAX_FAILURES) return;
        channel.close();
        source = null;
        startPolling();
      });
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        open();
        // Il recupero di quello che è successo mentre non si guardava.
        refresh();
      } else {
        closeChannel();
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    if (document.visibilityState === "visible") open();

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibility);
      closeChannel();
    };
  }, [url]);
}
