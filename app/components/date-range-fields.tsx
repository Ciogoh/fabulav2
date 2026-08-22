/**
 * Le date di una richiesta — tetto di 7 giorni, spunta per andare oltre,
 * motivo obbligatorio quando si va oltre. Condiviso fra il dialogo
 * "Richiedi" del catalogo e "Modifica date" sulla pagina di una richiesta:
 * la regola è la stessa nei due posti, non ha senso scriverla due volte.
 *
 * I campi restano controllati da chi lo usa (non tiene stato proprio):
 * il chiamante decide cosa fare del valore, incluso cosa succede quando si
 * sposta `from` oltre `to`.
 */

import { useT } from "~/i18n/use-t";

/** `2026-09-03` spostato di `days` giorni, restando su giorni interi UTC. */
export function shiftDayString(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + days))
    .toISOString()
    .slice(0, 10);
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
  const maxTo = longer ? undefined : shiftDayString(from, 6);

  return (
    <>
      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <label
            htmlFor="from"
            className="font-mono text-[0.68rem] uppercase tracking-widest text-faint"
          >
            {t("request.from")}
          </label>
          <input
            id="from"
            name="from"
            type="date"
            min={today}
            value={from}
            onChange={(event) => {
              onFromChange(event.target.value);
              if (to < event.target.value) onToChange(event.target.value);
            }}
            className="rounded border border-rule bg-card px-3 py-2 text-sm focus:outline-2 focus:outline-offset-2 focus:outline-accent"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label
            htmlFor="to"
            className="font-mono text-[0.68rem] uppercase tracking-widest text-faint"
          >
            {t("request.to")}
          </label>
          <input
            id="to"
            name="to"
            type="date"
            min={from}
            max={maxTo}
            value={to}
            onChange={(event) => onToChange(event.target.value)}
            className="rounded border border-rule bg-card px-3 py-2 text-sm focus:outline-2 focus:outline-offset-2 focus:outline-accent"
          />
        </div>
      </div>

      <p className="text-[0.8rem] text-muted">{t("request.maxSpan")}</p>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="longer"
          value="1"
          checked={longer}
          onChange={(event) => onLongerChange(event.target.checked)}
          className="h-4 w-4"
        />
        {t("request.longer")}
      </label>

      {longer && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="purpose"
            className="font-mono text-[0.68rem] uppercase tracking-widest text-faint"
          >
            {t("request.purpose")}
          </label>
          <textarea
            id="purpose"
            name="purpose"
            rows={3}
            required
            value={purpose}
            onChange={(event) => onPurposeChange(event.target.value)}
            className="rounded border border-rule bg-card px-3 py-2 text-sm focus:outline-2 focus:outline-offset-2 focus:outline-accent"
          />
        </div>
      )}
    </>
  );
}
