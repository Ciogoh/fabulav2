/**
 * La finestra di invio dei promemoria.
 *
 * Una funzione sola e due estremi, ed è tutto quello che c'è da provare qui:
 * il resto dello spazzatore parla al database e non è materia da test unitari
 * (vedi il capitolo *Test* di `CLAUDE.md`). Ma **gli estremi di una finestra
 * oraria sono il posto classico in cui si sbaglia di uno**, e un promemoria
 * che parte alle 7 del mattino o alle 21 di sera non lo segnala nessuno: lo
 * subiscono e basta.
 */

import { describe, expect, it } from "vitest";
import { isWithinSendWindow } from "~/lib/reminders.server";

describe("isWithinSendWindow", () => {
  it("tiene fuori la notte, che è il caso per cui esiste", () => {
    // Il giro parte al primo passaggio dopo la mezzanotte UTC, cioè all'una o
    // alle due di notte in Italia: senza la finestra, una notifica push
    // suonerebbe lì.
    expect(isWithinSendWindow(1)).toBe(false);
    expect(isWithinSendWindow(2)).toBe(false);
    expect(isWithinSendWindow(7)).toBe(false);
  });

  it("apre alle 8 e chiude alle 20, estremi compresi come si legge", () => {
    expect(isWithinSendWindow(8)).toBe(true);
    expect(isWithinSendWindow(19)).toBe(true);
    // Le 20 sono già fuori: «fino alle 20» vuol dire che alle 20 in punto non
    // si manda più, non che si manda per tutta l'ora delle 20.
    expect(isWithinSendWindow(20)).toBe(false);
    expect(isWithinSendWindow(23)).toBe(false);
  });
});
