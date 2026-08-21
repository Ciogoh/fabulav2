/**
 * Come si decide la lingua, in ordine di precedenza:
 *
 *   1. il cookie `lang`, se la persona ne ha scelta una a mano;
 *   2. l'intestazione `Accept-Language` del browser, al primo accesso;
 *   3. l'inglese.
 *
 * Quando l'accesso sarà collegato, la preferenza salvata su `User.language`
 * si inserirà al primo posto.
 */

import { isLang, LANGUAGES, type Lang } from "~/i18n/dictionaries";

const COOKIE_NAME = "lang";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function getLang(request: Request, saved?: string | null): Lang {
  // La preferenza del profilo ha la precedenza. Arriva come enum Prisma
  // maiuscolo (`IT`), i codici qui sono minuscoli (`it`).
  const fromProfile = saved?.toLowerCase();
  if (isLang(fromProfile)) return fromProfile;

  const fromCookie = readCookie(request.headers.get("Cookie"), COOKIE_NAME);
  if (isLang(fromCookie)) return fromCookie;

  return fromAcceptLanguage(request.headers.get("Accept-Language")) ?? "en";
}

export function langCookie(lang: Lang): string {
  return `${COOKIE_NAME}=${lang}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`;
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;

  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/**
 * `it-CH,it;q=0.9,en;q=0.8` → la prima lingua che sappiamo parlare.
 * Confrontiamo solo la parte prima del trattino: `de-AT` è tedesco.
 */
function fromAcceptLanguage(header: string | null): Lang | null {
  if (!header) return null;

  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="))
        ?.slice(2);

      return { base: tag.split("-")[0].toLowerCase(), q: q ? Number(q) : 1 };
    })
    .filter((entry) => !Number.isNaN(entry.q))
    .sort((a, b) => b.q - a.q);

  return ranked.find((entry) => LANGUAGES.includes(entry.base as Lang))
    ?.base as Lang | undefined ?? null;
}
