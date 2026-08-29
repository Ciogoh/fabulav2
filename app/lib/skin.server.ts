/**
 * La pelle si legge dal cookie, e si legge **sul server**.
 *
 * Stesso schema di `theme.server.ts`, stessa ragione: senza, il server manda
 * lo stile classico e il riso arriverebbe solo dopo che il JavaScript ha
 * girato — un lampo della pelle sbagliata a ogni caricamento.
 */

import { isSkin, type Skin } from "~/lib/skin";

const COOKIE_NAME = "skin";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function getSkin(request: Request): Skin {
  const value = readCookie(request.headers.get("Cookie"), COOKIE_NAME);
  return isSkin(value) ? value : "classic";
}

export function skinCookie(skin: Skin): string {
  return `${COOKIE_NAME}=${skin}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`;
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;

  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}
