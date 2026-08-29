/**
 * Chiaro, scuro, o quello che dice il sistema.
 *
 * **È una preferenza del dispositivo, non del profilo**, ed è la differenza
 * con la lingua — che invece sta su `User.language`. La lingua ha un
 * consumatore lato server: le email si scrivono nella lingua della persona,
 * e per saperlo quando la persona non è davanti allo schermo serve una
 * colonna. Il tema non lo legge nessuno tranne il browser che sta disegnando
 * la pagina in quel momento, e volere lo scuro sul telefono la sera e il
 * chiaro sul portatile in ufficio non è un capriccio: è il caso normale.
 *
 * Da qui: solo cookie, nessuna colonna nuova, nessuna migrazione.
 */

export const THEMES = ["auto", "light", "dark"] as const;

export type Theme = (typeof THEMES)[number];

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}
