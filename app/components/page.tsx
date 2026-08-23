/**
 * Il guscio di una pagina: una sola colonna, sempre allineata.
 *
 * Prima ogni rotta sceglieva la sua larghezza — `max-w-6xl` sul catalogo,
 * `3xl` sulle richieste, `md` sull'accesso — e passando da una pagina
 * all'altra il bordo sinistro del contenuto saltava, senza mai allinearsi al
 * nome in cima. Ora ce n'è una sola — `max-w-6xl` con `px-6`, le stesse
 * dell'intestazione — e `narrow` è un tetto di misura dentro a quella, non
 * un secondo contenitore centrato. Passando da una pagina all'altra il
 * contenuto resta sulla stessa verticale.
 */

import type { ReactNode } from "react";

/**
 * La colonna stretta non è un contenitore centrato per conto suo: è un tetto
 * di larghezza **dentro** alla colonna larga. Così il bordo sinistro di ogni
 * pagina cade sempre sotto la «F» di Fabula, mentre un `mx-auto max-w-3xl`
 * avrebbe spostato il contenuto verso il centro — che è esattamente il salto
 * che si voleva togliere.
 */
export function PageShell({
  width = "wide",
  className,
  children,
}: {
  width?: "wide" | "narrow" | "form";
  className?: string;
  children: ReactNode;
}) {
  /**
   * `form` è l'unica eccezione, e ha una ragione: accesso, benvenuto e
   * reimposta password sono un campo e un pulsante, e in una colonna larga
   * resterebbero sperduti in mezzo al vuoto. Lì il centraggio è voluto.
   * Non usarla per altro, o si torna alle sei larghezze di prima.
   */
  if (width === "form") {
    return (
      <div
        className={["mx-auto w-full max-w-md px-6", className]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={["mx-auto w-full max-w-6xl px-6", className]
        .filter(Boolean)
        .join(" ")}
    >
      {width === "narrow" ? <div className="max-w-3xl">{children}</div> : children}
    </div>
  );
}

/**
 * Il titolo della pagina, con il sottotitolo attaccato quando serve.
 * Un `h1` solo per pagina: è quello che i lettori di schermo annunciano per
 * primo, e averne due o zero è il modo più veloce per perdersi.
 */
export function PageTitle({
  title,
  intro,
  actions,
}: {
  title: string;
  intro?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {title}
        </h1>
        {intro && <p className="mt-1 max-w-prose text-sm text-muted">{intro}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
