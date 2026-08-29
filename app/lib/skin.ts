/**
 * Classico, o Riso — la pelle visiva.
 *
 * Gemello esatto di `theme.ts`: anche questa è una preferenza del
 * **dispositivo**, non della persona. Vedi lì per il perché — vale identico
 * qui, cambia solo il nome della cosa che si sceglie.
 */

export const SKINS = ["classic", "riso"] as const;

export type Skin = (typeof SKINS)[number];

export function isSkin(value: unknown): value is Skin {
  return typeof value === "string" && (SKINS as readonly string[]).includes(value);
}
