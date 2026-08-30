/**
 * Il piè di pagina: il credito e la versione.
 *
 * Prima non esisteva — la versione si vedeva solo nel registro admin e nella
 * schermata di errore. Con lo stile Riso il telaio prende anche il fondo, e
 * un piè di pagina è la metà mancante dell'intestazione a fascia.
 *
 * Legge `--chrome-*`, come `site-header.tsx`: nel classico è lo stesso fondo
 * della pagina, nel Riso è la fascia colorata.
 */

import { Link } from "react-router";
import { useT } from "~/i18n/use-t";
import { versionLabel } from "~/lib/version";
import type { Skin } from "~/lib/skin";

export function SiteFooter({ skin = "riso" }: { skin?: Skin }) {
  const t = useT();
  const chrome = skin === "riso";

  return (
    <footer
      className={
        chrome
          ? "border-t border-chrome-rule bg-chrome-bg px-6 py-4 font-mono text-2xs text-chrome-muted"
          : "border-t border-rule bg-card px-6 py-4 font-mono text-2xs text-muted"
      }
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-2">
          <span>{t("footer.credit")}</span>
          <span>·</span>
          <a
            href="https://www.instagram.com/mama.bz/"
            target="_blank"
            rel="noopener noreferrer"
            className={
              chrome
                ? "underline hover:text-chrome-ink transition-colors"
                : "underline hover:text-ink transition-colors"
            }
          >
            Instagram (MaMa)
          </a>
          <span>·</span>
          <a
            href="https://www.unibz.it"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-chrome-ink transition-colors"
          >
            unibz
          </a>
        </div>
        <div className="flex items-center gap-x-4">
          <Link
            to="/calendar"
            className="underline hover:text-chrome-ink transition-colors"
          >
            {t("footer.calendar")}
          </Link>
          <span>{versionLabel()}</span>
        </div>
      </div>
    </footer>
  );
}
