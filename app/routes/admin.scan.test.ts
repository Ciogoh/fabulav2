import { describe, expect, it } from "vitest";
import { handoverPathFrom, pickRearCamera } from "./admin.scan";

const ORIGIN = "https://fabulabz.com";

describe("handoverPathFrom", () => {
  it("accetta l'adesivo corto e lo riporta in minuscolo", () => {
    expect(handoverPathFrom(`${ORIGIN}/H/CMT3X9K2P0000`, ORIGIN)).toBe(
      "/admin/handover/cmt3x9k2p0000"
    );
  });

  it("accetta la forma lunga di prima, invariata", () => {
    expect(handoverPathFrom(`${ORIGIN}/admin/handover/cmt3x9k2p0000`, ORIGIN)).toBe(
      "/admin/handover/cmt3x9k2p0000"
    );
  });

  it("confronta l'origine senza distinguere maiuscole/minuscole", () => {
    expect(handoverPathFrom(`HTTPS://FABULABZ.COM/H/abc`, ORIGIN)).toBe(
      "/admin/handover/abc"
    );
  });

  it("rifiuta un altro host", () => {
    expect(handoverPathFrom("https://malicious.example/H/abc", ORIGIN)).toBeNull();
  });

  it("rifiuta uno schema javascript:", () => {
    expect(handoverPathFrom("javascript:alert(1)", ORIGIN)).toBeNull();
  });

  it("rifiuta un testo che non è un URL", () => {
    expect(handoverPathFrom("non un indirizzo", ORIGIN)).toBeNull();
  });

  it("rifiuta un percorso non atteso sulla nostra stessa origine", () => {
    expect(handoverPathFrom(`${ORIGIN}/qualcosa/altro`, ORIGIN)).toBeNull();
  });

  it("rifiuta un identificativo con una barra dentro", () => {
    expect(handoverPathFrom(`${ORIGIN}/H/abc/def`, ORIGIN)).toBeNull();
  });

  it("ignora query e frammenti: ricostruisce sempre dall'identificativo", () => {
    expect(handoverPathFrom(`${ORIGIN}/H/abc?x=1#y`, ORIGIN)).toBe("/admin/handover/abc");
  });
});

describe("pickRearCamera", () => {
  it("null quando non c'è nessuna fotocamera posteriore (solo webcam frontale)", () => {
    expect(pickRearCamera([{ id: "1", label: "FaceTime HD Camera" }])).toBeNull();
  });

  it("su Android prende l'indice più basso fra le posteriori non secondarie", () => {
    const cameras = [
      { id: "0", label: "camera2 0, facing back" },
      { id: "2", label: "camera2 2, facing back" },
      { id: "1", label: "camera2 1, facing front" },
    ];
    expect(pickRearCamera(cameras)).toBe("0");
  });

  it("scarta le posteriori secondarie (ultra, tele, macro, profondità)", () => {
    const cameras = [
      { id: "ultra", label: "camera2 0, facing back, ultra wide" },
      { id: "main", label: "camera2 1, facing back" },
    ];
    expect(pickRearCamera(cameras)).toBe("main");
  });

  it("su iPhone tiene «Back Dual Wide Camera»: «wide» da solo non è secondaria", () => {
    const cameras = [{ id: "iphone-main", label: "Back Dual Wide Camera" }];
    expect(pickRearCamera(cameras)).toBe("iphone-main");
  });

  it("scarta la vera ultra-wide su iPhone", () => {
    const cameras = [
      { id: "iphone-ultra", label: "Back Ultra Wide Camera" },
      { id: "iphone-main", label: "Back Camera" },
    ];
    expect(pickRearCamera(cameras)).toBe("iphone-main");
  });

  it("se scartando le secondarie non resta niente, tiene una posteriore qualsiasi", () => {
    const cameras = [{ id: "only-ultra", label: "camera2 0, facing back, ultra wide" }];
    expect(pickRearCamera(cameras)).toBe("only-ultra");
  });
});
