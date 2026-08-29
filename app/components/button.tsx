/**
 * L'unico posto in cui si decide come è fatto un pulsante.
 *
 * Prima ce n'erano quattro fatture diverse sparse per le rotte — accento
 * pieno, bordo accento, bordo grigio, testo sottolineato — e ogni schermata
 * nuova ne inventava una quinta. Peggio: il pulsante primario era scritto a
 * mano come `bg-accent text-white`, che nel tema scuro è bianco su azzurro
 * chiaro, 2,45:1. Qui il testo sopra l'accento è `--on-accent`, che nei due
 * temi vale bianco o inchiostro.
 *
 * Anche da spento un pulsante si deve leggere: lo stato «non si può premere»
 * lo dicono il bordo che perde l'accento e il cursore, non una scritta
 * sbiadita a 3,6:1. Per questo il disabilitato usa `--muted` e non `--faint`.
 *
 * Le altezze minime nascono dall'uso vero: l'associazione consegna gli oggetti
 * di persona, quindi la piattaforma si usa in magazzino col telefono in mano.
 * 44px è la misura comoda per un pollice; `sm` (36px) esiste solo per le
 * tabelle fitte del pannello admin, dove i bersagli sono comunque sopra i
 * 24px che chiede la WCAG 2.2.
 */

import { Link, type LinkProps } from "react-router";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "quiet"
  | "danger"
  | "destructive"
  | "plain";
export type ButtonSize = "md" | "sm";

/**
 * Perché `hover:` semplice e non `enabled:hover:`: `:enabled` è un pseudo
 * elemento dei soli controlli di modulo, e un `<a>` non lo soddisfa mai —
 * `ButtonLink` sarebbe rimasto senza hover del tutto. Lo stato spento si
 * annulla invece con `disabled:hover:`, che ha due pseudo classi e quindi
 * vince sul `hover:` semplice senza dipendere dall'ordine delle regole.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "rounded border border-transparent bg-accent font-medium text-on-accent hover:brightness-110 disabled:border-rule disabled:bg-sunk disabled:text-muted disabled:hover:brightness-100",
  secondary:
    "rounded border border-accent font-medium text-accent hover:bg-accent-soft disabled:border-rule disabled:text-muted disabled:hover:bg-transparent",
  quiet:
    "rounded border border-rule text-muted hover:border-ink hover:text-ink disabled:bg-sunk disabled:text-muted disabled:hover:border-rule disabled:hover:text-muted",
  danger:
    "rounded border border-rule text-muted hover:border-out hover:text-out disabled:bg-sunk disabled:text-muted disabled:hover:border-rule disabled:hover:text-muted",
  /**
   * La sesta variante, e la ragione per cui è sesta.
   *
   * `danger` è volutamente quieto: sta **in mezzo a una pagina**, accanto a
   * campi e ad altre azioni, e un «Elimina» rosso pieno in fondo a ogni
   * scheda griderebbe più del contenuto. Ma dentro alla finestra di conferma
   * la situazione è rovesciata: lì la scelta è già stata fatta, ci sono due
   * pulsanti soli, e quello che distrugge è **l'azione principale di quel
   * dialogo** — con la fattura del `danger` quieto restava meno vistoso di
   * «Annulla», che è l'esatto contrario di quello che deve succedere.
   *
   * Come il primario, il testo sopra il fondo pieno viene da un token
   * (`--on-out`) e non da `white`: nel tema scuro `--out-solid` è chiaro, e
   * lì sopra ci va inchiostro. 6,34:1 nel tema chiaro, 7,25:1 nello scuro.
   */
  destructive:
    "rounded border border-transparent bg-out-solid font-medium text-on-out hover:brightness-110 disabled:border-rule disabled:bg-sunk disabled:text-muted disabled:hover:brightness-100",
  // Senza cornice, ma con la stessa altezza degli altri: un «Annulla» alto
  // venti pixel accanto a un pulsante alto quarantaquattro è un bersaglio
  // che si manca.
  plain:
    "rounded text-muted underline underline-offset-4 hover:text-ink disabled:text-muted disabled:no-underline disabled:hover:text-muted",
};

/** Da spento il cursore lo dice sempre, in tutte le varianti. */
const DISABLED = "disabled:cursor-not-allowed";

const SIZES: Record<ButtonSize, string> = {
  md: "min-h-11 px-4 py-2 text-sm",
  sm: "min-h-9 px-3 py-1.5 text-sm",
};

export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  extra?: string
): string {
  return [
    "inline-flex items-center justify-center gap-2 text-center",
    DISABLED,
    VARIANTS[variant],
    SIZES[size],
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * L'attesa, quando un pulsante manda qualcosa al server.
 *
 * Prima l'unico segnale era il pulsante che si spegneva, e a un pulsante
 * spento mancano due cose per raccontare un'attesa: **non dice che sta
 * succedendo qualcosa** — spento vuol dire anche «non si può premere», che è
 * il contrario — e **non dice che finirà**. Su una connessione lenta, in
 * magazzino, il gesto successivo è ricaricare la pagina a metà di un invio.
 *
 * Il cerchietto è l'unica animazione dell'applicazione, e sta qui e non
 * altrove per questo motivo. `aria-busy` dice la stessa cosa a chi non lo
 * vede. L'etichetta la decide chi chiama e questo componente non la tocca:
 * sull'accesso cambia («Mando il codice…»), perché lì l'attesa è lunga e
 * vale spiegarla a parole; su un pulsante di elenco resta ferma, perché
 * cambiarla sposterebbe il testo delle righe accanto a ogni pressione.
 */
function Spinner() {
  return (
    <svg
      aria-hidden="true"
      data-busy-spinner=""
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0 animate-spin"
    >
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path
        d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Sta viaggiando qualcosa: cerchietto, `aria-busy`, e non si preme due volte. */
  busy?: boolean;
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  busy = false,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      className={buttonClass(variant, size, className)}
      {...rest}
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}

type ButtonLinkProps = LinkProps & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: ButtonLinkProps) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}
