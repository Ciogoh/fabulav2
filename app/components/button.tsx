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

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger" | "plain";
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

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      {...rest}
    />
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
