/**
 * Chiaro o scuro.
 *
 * **È una preferenza del dispositivo, non del profilo**, ed è la differenza
 * con la lingua — che invece sta su `User.language`. Il tema non lo legge
 * nessuno tranne il browser che sta disegnando la pagina in quel momento, e
 * volere lo scuro sul telefono la sera e il chiaro sul portatile in ufficio
 * non è un capriccio: è il caso normale.
 *
 * Da qui: solo cookie, nessuna colonna nuova, nessuna migrazione.
 *
 * **C'era anche «automatico»** (segui il sistema operativo), tolto su
 * richiesta esplicita: due stati da capire al volo battono tre, e chi vuole
 * lo scuro lo sceglie una volta sola invece di doversi chiedere perché la
 * pagina ha cambiato colore da sola.
 */

export const THEMES = ["light", "dark"] as const;

export type Theme = (typeof THEMES)[number];

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}
