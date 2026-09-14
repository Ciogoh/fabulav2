/**
 * Il piè di pagina: il credito e la build.
 *
 * Prima non esisteva — la versione si vedeva solo nel registro admin e nella
 * schermata di errore. Con lo stile Riso il telaio prende anche il fondo, e
 * un piè di pagina è la metà mancante dell'intestazione a fascia.
 *
 * Legge `--chrome-*`, come `site-header.tsx`: nel classico è lo stesso fondo
 * della pagina, nel Riso è la fascia colorata.
 *
 * A destra sta solo il numero di build, come `v72` (`BUILD_NUMBER`, non
 * `versionLabel()` per esteso): qui basta sapere «quale copia sta girando»,
 * la versione e la data per esteso restano nel registro admin e nella
 * schermata di errore, dove servono davvero.
 *
 * Il credito nomina il FABULA COLLECTIVE per esteso — MaMa e BITZ FabLab
 * linkati ai rispettivi siti, le quattro persone no. Non è a pezzi separati
 * in un contenitore flex con gap, ma una frase sola con le virgole vere: un
 * gap uniforme fra figli avrebbe messo uno spazio anche prima di ogni
 * virgola ("MaMa , BITZ FabLab").
 *
 * **L'icona di Instagram sta subito dopo «MaMa», non isolata a destra.**
 * Prima galleggiava accanto alla build, senza dire di chi fosse: era
 * l'Instagram di MaMa, ma niente lo collegava al nome. Ora è lì, come un
 * quarto elemento della stessa frase, e a destra resta solo la build.
 */

import { useT } from "~/i18n/use-t";
import { BUILD_NUMBER } from "~/lib/version";
import type { Skin } from "~/lib/skin";

export function SiteFooter({ skin = "riso" }: { skin?: Skin }) {
  const t = useT();
  const chrome = skin === "riso";
  const linkClass = chrome
    ? "underline hover:text-chrome-ink transition-colors"
    : "underline hover:text-ink transition-colors";

  return (
    <footer
      className={
        chrome
          ? "border-t border-chrome-rule bg-chrome-bg px-6 py-4 font-mono text-2xs text-chrome-muted"
          : "border-t border-rule bg-card px-6 py-4 font-mono text-2xs text-muted"
      }
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2">
        {/* Frase unica, non a pezzi in flex con gap: i nomi sono separati da
            virgole vere ("MaMa, BITZ FabLab, Dario Vedova...") e un gap
            uniforme fra figli flex avrebbe messo uno spazio anche prima di
            ogni virgola. Qui il testo scorre come una frase normale. */}
        <p className="max-w-3xl">
          {t("footer.creditPrefix")}{" "}
          <a href="https://mamabz.com" target="_blank" rel="noopener noreferrer" className={linkClass}>
            {t("footer.mama")}
          </a>{" "}
          <a
            href="https://www.instagram.com/mama.unibz/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("footer.instagram")}
            className={`inline-flex align-middle ${chrome ? "text-chrome-muted hover:text-chrome-ink" : "text-muted hover:text-ink"} transition-colors`}
          >
            <InstagramIcon className="h-3.5 w-3.5" />
          </a>
          {", "}
          <a href="https://bitzfablab.unibz.it/" target="_blank" rel="noopener noreferrer" className={linkClass}>
            {t("footer.bitz")}
          </a>
          {t("footer.creditSuffix")}
        </p>
        <span>v{BUILD_NUMBER}</span>
      </div>
    </footer>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
