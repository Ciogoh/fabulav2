/**
 * Le date di una richiesta — tetto di 7 giorni, spunta per andare oltre,
 * motivo obbligatorio quando si va oltre. Condiviso fra il foglio «Richiedi»
 * del catalogo e «Modifica date» sulla pagina di una richiesta: la regola è la
 * stessa nei due posti, non ha senso scriverla due volte.
 *
 * I campi restano controllati da chi lo usa (non tiene stato proprio):
 * il chiamante decide cosa fare del valore, incluso cosa succede quando si
 * sposta `from` oltre `to`.
 *
 * **Perché il campo «a cosa serve» non sta più dentro alla spunta.** Prima
 * esisteva solo per le richieste oltre i sette giorni, e chi ne chiedeva tre
 * non aveva nessun posto dove scrivere «mi serve anche il carrello» o «passo
 * a ritirarlo di sabato»: l'unico canale era la chat, che però nasce *dopo*
 * l'invio, quando l'admin ha già letto una richiesta nuda. Ora il campo c'è
 * sempre, ed è la spunta a renderlo obbligatorio — non a farlo esistere.
 * Di conseguenza l'ordine è date → avviso → campo → spunta: il campo si legge
 * come parte normale della richiesta e non come conseguenza di una casella.
 *
 * **Perché il tetto non è più un attributo `max`.** Prima il campo «Fino a»
 * portava `max={from + 6 giorni}`: il browser rendeva l'ottavo giorno
 * semplicemente non selezionabile, in silenzio. Chi ne voleva dieci provava a
 * cliccare, non succedeva niente, e l'unica spiegazione era una riga grigia
 * sotto ai campi che nessuno collega a un clic che non ha funzionato. Ora il
 * giorno si sceglie eccome, e la regola si spiega nel momento in cui la si
 * supera — con accanto la spunta che la toglie. Il limite vero resta comunque
 * lato server, in `requests.tsx`: questo è un avviso, non una difesa.
 */

import { useId } from "react";
import { useT } from "~/i18n/use-t";
import { MAX_ORDINARY_SPAN_DAYS } from "~/lib/availability.shared";

/** `2026-09-03` spostato di `days` giorni, restando su giorni interi UTC. */
export function shiftDayString(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + days))
    .toISOString()
    .slice(0, 10);
}

/** Quanti giorni copre il periodo, estremi inclusi: dal 5 al 5 è un giorno. */
export function daysBetweenInclusive(from: string, to: string): number {
  if (!from || !to) return 0;
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.round((end - start) / 86_400_000) + 1;
}

export function DateRangeFields({
  today,
  from,
  to,
  longer,
  purpose,
  onFromChange,
  onToChange,
  onLongerChange,
  onPurposeChange,
}: {
  today: string;
  from: string;
  to: string;
  longer: boolean;
  purpose: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onLongerChange: (value: boolean) => void;
  onPurposeChange: (value: string) => void;
}) {
  const t = useT();
  // Il componente compare due volte nella stessa applicazione (foglio e
  // pagina di una richiesta): con `id="from"` scritto a mano, due campi
  // avrebbero lo stesso identificativo e le etichette punterebbero al primo.
  const uid = useId();
  const fromId = `${uid}-from`;
  const toId = `${uid}-to`;
  const purposeId = `${uid}-purpose`;
  const hintId = `${uid}-hint`;
  const purposeHintId = `${uid}-purpose-hint`;

  const span = daysBetweenInclusive(from, to);
  const overLimit = span > MAX_ORDINARY_SPAN_DAYS;

  const label =
    "font-mono text-[0.68rem] uppercase tracking-widest text-muted";
  const field =
    "min-h-11 rounded border border-rule bg-card px-3 py-2 text-sm";

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <div className="flex min-w-36 flex-1 flex-col gap-1.5">
          <label htmlFor={fromId} className={label}>
            {t("request.from")}
          </label>
          <input
            id={fromId}
            name="from"
            type="date"
            min={today}
            value={from}
            aria-describedby={hintId}
            onChange={(event) => {
              onFromChange(event.target.value);
              if (to < event.target.value) onToChange(event.target.value);
            }}
            className={field}
          />
        </div>
        <div className="flex min-w-36 flex-1 flex-col gap-1.5">
          <label htmlFor={toId} className={label}>
            {t("request.to")}
          </label>
          <input
            id={toId}
            name="to"
            type="date"
            min={from}
            value={to}
            aria-describedby={hintId}
            onChange={(event) => onToChange(event.target.value)}
            className={field}
          />
        </div>
      </div>

      {/* La stessa riga fa due mestieri: dice la regola prima, e dice cosa
          hai appena fatto quando la superi. `aria-live` perché chi usa un
          lettore di schermo deve sentirlo cambiare senza andarlo a cercare. */}
      <p
        id={hintId}
        aria-live="polite"
        className={`text-[0.8rem] ${
          overLimit && !longer ? "text-out" : "text-muted"
        }`}
      >
        {span > 0 && overLimit && !longer
          ? t("request.spanOver", { count: span })
          : span === 1
            ? t("request.spanOne")
            : span > 1
              ? t("request.spanOk", { count: span })
              : t("request.maxSpan")}
      </p>

      {/* Il campo c'è sempre; la spunta ne cambia solo l'etichetta, l'aiuto e
          l'obbligatorietà. `maxLength` perché è testo libero che finisce in
          una colonna senza tetto: il taglio vero resta lato server. */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={purposeId} className={label}>
          {longer ? t("request.purposeRequired") : t("request.purpose")}
        </label>
        <textarea
          id={purposeId}
          name="purpose"
          rows={3}
          required={longer}
          maxLength={2000}
          value={purpose}
          aria-describedby={purposeHintId}
          onChange={(event) => onPurposeChange(event.target.value)}
          className="rounded border border-rule bg-card px-3 py-2 text-sm"
        />
        <p id={purposeHintId} className="text-[0.8rem] text-muted">
          {longer ? t("request.purposeHintRequired") : t("request.purposeHint")}
        </p>
      </div>

      {/* Bersaglio comodo: la spunta era 16×16px, sotto ai 24 che chiede la
          WCAG 2.2 e ben sotto a un pollice. L'area cliccabile è tutta la
          riga, etichetta compresa. */}
      {/* Con il campo in mezzo, l'avviso «spunta la casella» e la casella non
          si toccano più: finché il tetto è superato la riga si accende, così
          l'occhio ci arriva senza doverla cercare. */}
      <label
        className={`-my-1 flex min-h-11 cursor-pointer items-center gap-3 rounded px-2 text-sm ${
          overLimit && !longer ? "bg-accent-soft" : ""
        }`}
      >
        <input
          type="checkbox"
          name="longer"
          value="1"
          checked={longer}
          onChange={(event) => onLongerChange(event.target.checked)}
          className="h-5 w-5 shrink-0 accent-[var(--accent)]"
        />
        {t("request.longer")}
      </label>
    </>
  );
}
