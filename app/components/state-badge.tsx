/**
 * Il pallino di stato di un oggetto.
 *
 * **Il colore risponde a una domanda sola: «lo prendo adesso?»** — non «a che
 * punto del ciclo di vita è». Prima faceva le due cose insieme, e sbagliava
 * la più importante: un oggetto sullo scaffale con una prenotazione fra tre
 * giorni portava un badge arancione «Prenotato», che chi sfoglia il catalogo
 * legge come «non ce l'hai» e passa oltre.
 *
 * `RESERVED` porta infatti due realtà opposte: con `from` la prenotazione
 * deve ancora cominciare e oggi l'oggetto è libero; senza, è già cominciata e
 * l'oggetto non si può avere. Stessa parola, stesso colore, risposta
 * contraria — per questo qui lo stato di dominio in ingresso viene tradotto
 * in uno stato **visivo**, e la prenotazione futura scende di un livello:
 * diventa la riga piccola accanto al badge.
 *
 * L'arancione resta giusto sul calendario, dove la barra è appoggiata sul
 * giorno a cui si riferisce. Su una scheda l'asse del tempo non c'è, e ogni
 * badge viene letto come «adesso».
 *
 * Lo stato non è mai solo colore: ogni pallino porta anche la parola e, quando
 * c'è, la data. Chi non distingue i colori deve capire lo stesso, e su un
 * elenco stampato il colore sparisce del tutto.
 *
 * `NOT_BOOKABLE` è il quarto caso ed è entrato qui apposta: prima era testo
 * grigio nudo dentro alla scheda del catalogo, l'unico stato senza pallino,
 * e sembrava una nota a margine invece dello stato dell'oggetto. Ha colori
 * neutri — non è un guasto da segnalare in rosso, è un oggetto che non si
 * presta e basta.
 *
 * ## I due toni, e la forma
 *
 * **`tone="solid"`** è il catalogo e la scheda di un oggetto: fondo pieno,
 * perché lì la domanda si legge da lontano e su una griglia di venti schede
 * tre velature hanno tutte lo stesso peso visivo — si distinguevano solo
 * leggendole una per una. **`tone="soft"`** resta per gli elenchi fitti
 * dell'admin, dove dodici pastiglie piene di fila diventano una coperta.
 *
 * `NOT_BOOKABLE` **non** si riempie nemmeno nel tono pieno: resta un contorno.
 * Un grigio pieno griderebbe quanto il rosso, e la gerarchia vera è che i
 * segnali forti sono due — si può o non si può — mentre «non prestabile» è
 * assenza di gioco, non un allarme.
 *
 * **La forma** (il carattere prima della parola) porta lo stesso significato
 * senza colore: circa un uomo su dodici non distingue verde e rosso, e su un
 * elenco stampato in bianco e nero non li distingue nessuno. È `aria-hidden`
 * perché chi usa un lettore di schermo la parola ce l'ha già.
 */

import type { DisplayState } from "~/lib/availability.server";
import { isUpcomingSoon } from "~/lib/availability.shared";
import { useFormatDay, useT } from "~/i18n/use-t";

/** Lo stato di dominio che arriva dal motore di disponibilità. */
export type BadgeState = DisplayState | "NOT_BOOKABLE";

/** Quello che si vede davvero: «libero» o «no», più i due casi a parte. */
type VisualState = Exclude<BadgeState, "RESERVED">;

/** Quanto forte parla il badge. Vedi il blocco in cima. */
export type BadgeTone = "solid" | "soft";

export type BadgeInfo = {
  state: BadgeState;
  until?: Date | string | null;
  from?: Date | string | null;
  /** Oggi, `YYYY-MM-DD`, dal loader. Non `new Date()` qui dentro: «oggi» sul
   * server e «oggi» nel browser possono essere due giorni diversi, e React se
   * ne accorge in idratazione. */
  today: string;
  tone?: BadgeTone;
};

const SOFT: Record<VisualState, string> = {
  FREE: "text-free bg-free-bg",
  IN_USE: "text-out bg-out-bg",
  UNAVAILABLE: "text-out bg-out-bg",
  NOT_BOOKABLE: "text-idle bg-idle-bg",
};

const SOLID: Record<VisualState, string> = {
  FREE: "text-on-free bg-free-solid",
  IN_USE: "text-on-out bg-out-solid",
  UNAVAILABLE: "text-on-out bg-out-solid",
  // Contorno e non riempimento: vedi il blocco in cima.
  NOT_BOOKABLE: "text-idle border border-idle",
};

/** La forma che dice lo stato quando il colore non c'è. */
const SHAPES: Record<VisualState, string> = {
  FREE: "●", // ● pieno: «c'è»
  IN_USE: "▪", // ▪ quadrato: «bloccato»
  UNAVAILABLE: "▪",
  NOT_BOOKABLE: "◇", // ◇ vuoto: assenza di stato, non un guasto
};

const LABELS = {
  FREE: "state.free",
  IN_USE: "state.inUse",
  UNAVAILABLE: "state.unavailable",
  NOT_BOOKABLE: "state.notBookable",
} as const;

/**
 * Lo stato visivo, che è quello che decide anche il colore della fascia sulla
 * scheda del catalogo. Esportato perché quella fascia e questo badge devono
 * raccontare la stessa cosa: se divergessero, la scheda direbbe una cosa e la
 * pastiglia dentro un'altra.
 */
export function visualStateOf(
  state: BadgeState,
  from?: Date | string | null
): VisualState {
  if (state !== "RESERVED") return state;
  // Una prenotazione che deve ancora cominciare non toglie niente a oggi.
  return from ? "FREE" : "IN_USE";
}

export function StateBadge({ state, until, from, today, tone = "soft" }: BadgeInfo) {
  const t = useT();
  const formatDay = useFormatDay();

  const upcoming = state === "RESERVED" && from ? from : null;
  const visual = visualStateOf(state, from);

  /* La mezza riga più utile della scheda, in `--muted` e non in `--faint`:
     quando l'oggetto è occupato, quando torna; quando è libero ma già
     promesso, il periodo promesso — ma solo se è vicino, o su un catalogo
     pieno diventa una riga di rumore sotto a ogni oggetto. */
  const detail = upcoming
    ? until && isUpcomingSoon(upcoming, today)
      ? t("state.bookedRange", {
          start: formatDay(upcoming),
          end: formatDay(until),
        })
      : null
    : until
      ? t("state.backOn", { date: formatDay(until) })
      : null;

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-2xs font-medium uppercase tracking-wider ${
          tone === "solid" ? SOLID[visual] : SOFT[visual]
        }`}
      >
        <span aria-hidden="true" className="text-[0.6em] leading-none">
          {SHAPES[visual]}
        </span>
        {t(LABELS[visual])}
      </span>
      {detail && (
        <span className="font-mono text-2xs text-muted">{detail}</span>
      )}
    </span>
  );
}
