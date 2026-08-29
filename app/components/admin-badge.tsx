/**
 * Il pallino "Admin".
 *
 * Usa i token della modalità admin, non `--out`: prima prendeva in prestito
 * il rosso dell'indisponibilità, e nella stessa schermata lo stesso colore
 * diceva «questa persona amministra» e «questo oggetto è guasto». Quando la
 * palette diventerà monocromatica col rosso come accento di brand (vedi
 * «Aspetto» in CLAUDE.md) questo pallino non andrà toccato.
 */

import { useT } from "~/i18n/use-t";

export function AdminBadge() {
  const t = useT();

  return (
    <span className="inline-block rounded-full border border-admin-rule bg-admin-bg px-2 py-0.5 font-mono text-2xs font-medium uppercase tracking-wider text-muted">
      {t("members.badgeAdmin")}
    </span>
  );
}
