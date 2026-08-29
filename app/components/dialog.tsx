/**
 * Il guscio di un dialogo modale — uno solo, come per i pulsanti e le
 * larghezze di pagina.
 *
 * Le regole di un modale erano scritte in un posto solo perché di modali ce
 * n'era uno solo: il foglio della richiesta, dentro a `cart-bar.tsx`. Il
 * giorno in cui è servito il secondo — la conferma di un'azione che non si
 * torna indietro — la scelta era copiare cinquanta righe di trappola del
 * fuoco oppure tirarle fuori di lì. Sono qui.
 *
 * Cosa fa, e perché ognuna di queste cose non è facoltativa:
 *
 * - **Il fuoco entra e ci resta.** Senza, col solo tasto Tab si finiva a
 *   navigare la pagina *dietro* al foglio senza vedere dove si era: il
 *   contorno di fuoco esiste, ma è coperto dal velo.
 * - **Alla chiusura il fuoco torna da dove era partito.** Chi apre il foglio
 *   da un pulsante deve ritrovarsi su quel pulsante, non in cima al
 *   documento.
 * - **Escape chiude**, e il click sul velo pure: sono i due gesti che tutti
 *   provano per primi.
 * - **La pagina dietro non scorre** (`data-dialog-open` su `<body>`, la
 *   regola sta in `app.css`): sul telefono, senza, si trascina il catalogo
 *   invece del contenuto del foglio.
 * - **Il velo è `bg-black/60`, mai `bg-ink/50`.** Nel tema scuro `--ink` è
 *   chiaro: quel velo *schiariva* la pagina dietro invece di spegnerla.
 *
 * Il fuoco iniziale va sul **primo campo**, non sulla ✕: un foglio si apre
 * per scriverci dentro, e chi arriva da tastiera deve trovarsi già dove si
 * scrive. Quando campi non ce ne sono — una conferma è due pulsanti — cade
 * sul primo pulsante, che lì è la cosa giusta.
 */

import { useEffect, useRef, type ReactNode } from "react";

export function Dialog({
  onClose,
  labelledBy,
  describedBy,
  panelClassName = "max-w-md",
  children,
}: {
  onClose: () => void;
  /** L'`id` del titolo dentro al pannello: è il nome del dialogo. */
  labelledBy: string;
  describedBy?: string;
  panelClassName?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    document.body.dataset.dialogOpen = "true";

    const panel = panelRef.current;
    const first =
      panel?.querySelector<HTMLElement>("input, select, textarea") ??
      panel?.querySelector<HTMLElement>("button, a[href], [tabindex]");
    first?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      const focusable = [
        ...panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ),
      ].filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;

      const start = focusable[0]!;
      const end = focusable[focusable.length - 1]!;
      const active = document.activeElement;

      if (event.shiftKey && (active === start || !panel.contains(active))) {
        event.preventDefault();
        end.focus();
      } else if (!event.shiftKey && active === end) {
        event.preventDefault();
        start.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      delete document.body.dataset.dialogOpen;
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {/* Sul telefono sale dal basso e resta attaccato al bordo — il pollice
          arriva lì; da 640px in su è una finestra centrata con tutti e
          quattro gli angoli tondi. */}
      <div
        ref={panelRef}
        className={`flex max-h-[90dvh] w-full flex-col overflow-y-auto rounded-t-sm border border-rule bg-card p-5 sm:rounded-sm ${panelClassName}`}
      >
        {children}
      </div>
    </div>
  );
}
