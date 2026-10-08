/** Esempi delle invarianti P2P: identità, raggruppamento e recupero dell'invio. */
import { describe, expect, it } from "vitest";
import {
  groupByLender,
  requestCapabilities,
  parseCartItems,
  submissionContent,
  canEditProposal,
} from "~/lib/marketplace";
describe("gruppi del carrello", () => {
  it("crea un gruppo per prestatore e uno solo per Material Matters", () => {
    const groups = groupByLender([
      { id: "a", ownerId: null },
      { id: "b", ownerId: "socio-a" },
      { id: "c", ownerId: null },
      { id: "d", ownerId: "socio-b" },
    ]);
    expect(groups.map((g) => [g.lenderId, g.assets.map((a) => a.id)])).toEqual([
      [null, ["a", "c"]],
      ["socio-a", ["b"]],
      ["socio-b", ["d"]],
    ]);
  });
  it("deduplica gli oggetti provenienti anche da un kit", () => {
    expect(
      parseCartItems(
        JSON.stringify([
          { assetId: "b", fromKitId: "kit" },
          { assetId: "a" },
          { assetId: "b" },
        ]),
      ),
    ).toEqual([
      { assetId: "a", fromKitId: undefined },
      { assetId: "b", fromKitId: "kit" },
    ]);
  });
  it("rifiuta payload non validi e carrelli costruiti oltre il limite", () => {
    expect(parseCartItems("null")).toBeNull();
    expect(parseCartItems('[{"assetId":4}]')).toBeNull();
    expect(
      parseCartItems(
        JSON.stringify(
          Array.from({ length: 101 }, (_, n) => ({ assetId: String(n) })),
        ),
      ),
    ).toBeNull();
  });
  it("la firma non dipende dall'ordine, ma cambia con date o provenienza", () => {
    const a = submissionContent(
      [{ assetId: "b" }, { assetId: "a" }],
      "2026-10-10",
      "2026-10-12",
      " laboratorio ",
    );
    expect(a).toBe(
      submissionContent(
        [{ assetId: "a" }, { assetId: "b" }],
        "2026-10-10",
        "2026-10-12",
        "laboratorio",
      ),
    );
    expect(a).not.toBe(
      submissionContent(
        [{ assetId: "a", fromKitId: "kit" }, { assetId: "b" }],
        "2026-10-10",
        "2026-10-12",
        "laboratorio",
      ),
    );
  });
});
describe("capacità della pratica", () => {
  const req = { userId: "richiedente", lenderId: "prestatore" };
  it("il socio prestatore decide, ma non cambia le date per conto del richiedente", () => {
    expect(
      requestCapabilities({ id: "prestatore", role: "MEMBER" }, req),
    ).toMatchObject({
      read: true,
      manage: true,
      edit: false,
      seen: "lenderSeenAt",
    });
  });
  it("un richiedente admin non approva da solo il proprio prestito", () => {
    expect(
      requestCapabilities({ id: "richiedente", role: "ADMIN" }, req),
    ).toMatchObject({
      read: true,
      manage: false,
      edit: true,
      seen: "userSeenAt",
    });
  });
  it("l'admin può assistere e l'estraneo non legge", () => {
    expect(
      requestCapabilities({ id: "admin", role: "ADMIN" }, req),
    ).toMatchObject({ read: true, manage: true, seen: "adminSeenAt" });
    expect(
      requestCapabilities({ id: "estraneo", role: "MEMBER" }, req),
    ).toMatchObject({ read: false, manage: false, edit: false });
  });
  it("il ruolo admin del prestatore non cambia il segnalibro personale", () => {
    expect(
      requestCapabilities({ id: "prestatore", role: "ADMIN" }, req).seen,
    ).toBe("lenderSeenAt");
  });
});
describe("revisione della scheda", () => {
  it("si corregge una bozza o un rifiuto, non una pubblicazione senza ritiro", () => {
    expect(
      ["DRAFT", "PENDING", "APPROVED", "REJECTED"].map((s) =>
        canEditProposal(s as "DRAFT" | "PENDING" | "APPROVED" | "REJECTED"),
      ),
    ).toEqual([true, false, false, true]);
  });
});
