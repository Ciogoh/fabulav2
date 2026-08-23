/**
 * Le costanti della disponibilità che servono **anche nel browser**.
 *
 * Stanno qui e non in `availability.server.ts` per un motivo solo: quel file
 * importa il database, quindi importarlo da un componente si porterebbe
 * Prisma dentro al pacchetto del browser. I limiti di durata invece servono
 * da entrambe le parti — il foglio della richiesta li usa per avvisare mentre
 * si scrive, l'azione per rifiutare davvero — e devono essere lo stesso
 * numero, non due copie destinate a divergere.
 */

/** Sette giorni interi vuol dire una differenza di sei fra inizio e fine. */
export const MAX_ORDINARY_SPAN_DAYS = 7;

/** Tetto anche per le richieste speciali: contro input assurdi, non contro
 * richieste legittime — nessuna associazione presta qualcosa per un anno. */
export const MAX_SPECIAL_SPAN_DAYS = 90;

/**
 * Fin dove una prenotazione futura vale una riga in catalogo.
 *
 * Oltre questa soglia la scheda dice solo «Libero»: i prestiti ordinari
 * durano al massimo `MAX_ORDINARY_SPAN_DAYS`, quindi una prenotazione fra
 * mesi non cambia niente a chi sta decidendo adesso — è rumore su ogni
 * scheda. Chi pianifica lontano ha la scheda dell'oggetto e il calendario.
 */
export const UPCOMING_NOTE_DAYS = 14;

/**
 * Una prenotazione futura è abbastanza vicina da annunciarla?
 *
 * `today` arriva dal loader come `YYYY-MM-DD` e non da `new Date()` nel
 * browser: «oggi» sul server e «oggi» sul telefono di chi guarda possono
 * essere due giorni diversi, e React se ne accorge in idratazione.
 */
export function isUpcomingSoon(from: Date | string, today: string): boolean {
  const start = new Date(from).getTime();
  const limit =
    new Date(`${today}T00:00:00.000Z`).getTime() +
    UPCOMING_NOTE_DAYS * 86_400_000;
  return start <= limit;
}
