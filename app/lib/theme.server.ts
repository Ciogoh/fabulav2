/**
 * Il tema si legge dal cookie, e si legge **sul server**.
 *
 * Non è un dettaglio di comodo: è l'unica versione senza il lampo bianco.
 * Con la scelta in `localStorage` il server non sa niente, manda una pagina
 * chiara, e lo scuro arriva quando il JavaScript ha girato — un lampo in
 * faccia a chi apre Fabula al buio, ogni singola volta. Con il cookie
 * l'attributo `data-theme` è già dentro all'HTML che parte, e non c'è nessun
 * istante in cui la pagina sia del colore sbagliato.
 *
 * Stesso schema del cookie della lingua (`i18n/lang.server.ts`), e i due
 * lettori di cookie sono volutamente due: questo file non deve importare
 * niente da `i18n`, e sono sei righe.
 */

import { isTheme, type Theme } from "~/lib/theme";

const COOKIE_NAME = "theme";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function getTheme(request: Request): Theme {
  const value = readCookie(request.headers.get("Cookie"), COOKIE_NAME);
  // «auto» non è un ripiego: è la scelta giusta finché nessuno ne ha fatta
  // un'altra, perché il sistema operativo la domanda l'ha già fatta una volta.
  return isTheme(value) ? value : "auto";
}

export function themeCookie(theme: Theme): string {
  return `${COOKIE_NAME}=${theme}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`;
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;

  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}
