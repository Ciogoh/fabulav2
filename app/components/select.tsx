/**
 * L'unico menu a tendina.
 *
 * Un `<select>` nudo si porta dietro la freccia del sistema operativo: su
 * macOS è un rettangolo azzurro con due frecce, su Windows un triangolo
 * grigio, e accanto a un campo di testo disegnato da noi si vede che sono due
 * cose di due mondi diversi. `appearance-none` toglie quella e ci mette la
 * nostra, che segue `--muted` come ogni altro segno piccolo dell'interfaccia.
 *
 * L'elenco che si apre resta invece quello del sistema, e va bene così: è
 * l'unica versione che funziona col dito, con la tastiera e con un lettore di
 * schermo. `color-scheme` sta su `:root`, quindi segue già il tema.
 */

import type { ComponentProps } from "react";

export function Select({ className = "", children, ...props }: ComponentProps<"select">) {
  return (
    <span className="relative block">
      <select
        {...props}
        className={`min-h-11 w-full appearance-none rounded-sm border border-rule bg-card py-2 pl-3 pr-9 text-sm hover:border-muted ${className}`}
      >
        {children}
      </select>

      {/* Decorazione: `pointer-events-none`, o il click si ferma sulla freccia
          invece di aprire il menu che sta sotto. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-muted"
      >
        <path d="M2.5 4.5 6 8l3.5-3.5" />
      </svg>
    </span>
  );
}
