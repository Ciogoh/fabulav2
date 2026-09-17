/**
 * Un campo password con l'occhiello per vederla mentre la si scrive.
 *
 * Prima erano tre copie quasi identiche di `<label>` + `<input
 * type="password">`, sparse fra `signin.tsx`, `reset-password.tsx` e
 * `welcome.tsx` — nessuna con un modo di controllare cosa si sta scrivendo.
 * Su un campo dove un refuso costa un accesso mancato (o, per
 * `reset-password`/`welcome`, una password mai più letta da nessuno), è
 * l'occhiello a mancare, non il resto: da qui un componente solo invece di
 * aggiungerlo tre volte.
 *
 * Lo stato (`visible`) resta locale al campo: non c'è nessun motivo per cui
 * mostrare una password dovrebbe farne comparire un'altra sullo stesso
 * modulo.
 */

import { useState } from "react";
import { useT } from "~/i18n/use-t";

export function PasswordField({
  label,
  name,
  className = "",
  autoFocusOnMount = false,
  ...rest
}: {
  label: string;
  name: string;
  className?: string;
  /** Vedi lo stesso parametro su `Field` in `signin.tsx`: il focus si mette
   * con un ref e non con `autoFocus`, che la regola di accessibilità vieta. */
  autoFocusOnMount?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const t = useT();
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="eyebrow">
        {label}
      </label>
      <div className="relative">
        <input
          id={name}
          name={name}
          type={visible ? "text" : "password"}
          ref={(node) => {
            if (autoFocusOnMount) node?.focus();
          }}
          className={`min-h-11 w-full rounded-sm border border-rule bg-card px-3 py-2.5 pr-11 text-sm ${className}`}
          {...rest}
        />
        {/* 44px anche qui, come ogni bersaglio dell'applicazione — vedi
            regola 7 in CLAUDE.md. `tabIndex={-1}` lo toglierebbe
            dall'ordine di tabulazione, ma qui va bene restarci: chi naviga
            da tastiera deve poter arrivare all'occhiello quanto a chi
            preme "Entra". */}
        <button
          type="button"
          onClick={() => setVisible((was) => !was)}
          aria-label={t(visible ? "password.hide" : "password.show")}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex min-h-11 w-11 items-center justify-center text-muted hover:text-ink"
        >
          <EyeIcon open={visible} />
        </button>
      </div>
    </div>
  );
}

/** Occhio aperto, o con un tratto sopra — stesso vocabolario di icona che
 * chiunque si aspetta da un campo password, in qualunque app. */
function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="h-4 w-4">
        <path
          d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="h-4 w-4">
      <path
        d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 13.5 14 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
