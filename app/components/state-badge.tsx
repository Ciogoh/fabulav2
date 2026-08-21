/**
 * Il pallino di stato di un oggetto.
 *
 * Lo stato non è mai solo colore: ogni pallino porta anche la parola e, quando
 * c'è, la data. Chi non distingue i colori deve capire lo stesso, e su un
 * elenco stampato il colore sparisce del tutto.
 */

import type { DisplayState } from "~/lib/availability.server";
import { useFormatDay, useT } from "~/i18n/use-t";

export type BadgeInfo = {
  state: DisplayState;
  until?: Date | string | null;
  from?: Date | string | null;
};

const STYLES: Record<DisplayState, string> = {
  FREE: "text-free bg-free-bg",
  RESERVED: "text-held bg-held-bg",
  IN_USE: "text-out bg-out-bg",
  UNAVAILABLE: "text-out bg-out-bg",
};

const LABELS = {
  FREE: "state.free",
  RESERVED: "state.reserved",
  IN_USE: "state.inUse",
  UNAVAILABLE: "state.unavailable",
} as const;

export function StateBadge({ state, until, from }: BadgeInfo) {
  const t = useT();
  const formatDay = useFormatDay();

  // La data più utile: quando comincia se deve ancora cominciare,
  // altrimenti quando l'oggetto torna.
  const detail = from
    ? t("state.fromDate", { date: formatDay(from) })
    : until
      ? t("state.backOn", { date: formatDay(until) })
      : null;

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2">
      <span
        className={`inline-block rounded-full px-2 py-0.5 font-mono text-[0.68rem] font-medium uppercase tracking-wider ${STYLES[state]}`}
      >
        {t(LABELS[state])}
      </span>
      {detail && (
        <span className="font-mono text-[0.7rem] text-faint">{detail}</span>
      )}
    </span>
  );
}
