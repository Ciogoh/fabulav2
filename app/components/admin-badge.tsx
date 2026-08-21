/**
 * Il pallino "Admin".
 *
 * Usa `--out`, non `--accent`: l'accento di brand è il rosso, ma la
 * palette attuale (blu) è provvisoria — vedi «Aspetto» in CLAUDE.md.
 * `--out` è già il colore più acceso disponibile oggi.
 */

import { useT } from "~/i18n/use-t";

export function AdminBadge() {
  const t = useT();

  return (
    <span className="inline-block rounded-full bg-out-bg px-2 py-0.5 font-mono text-[0.66rem] font-medium uppercase tracking-wider text-out">
      {t("members.badgeAdmin")}
    </span>
  );
}
