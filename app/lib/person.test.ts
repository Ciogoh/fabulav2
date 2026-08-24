import { describe, expect, it } from "vitest";
import {
  cleanName,
  displayNameOf,
  fullLabelOf,
  fullNameOf,
  givenNameLast,
  hasSeparateFullName,
  isUploadedAvatar,
  splitName,
} from "~/lib/person";

describe("cleanName", () => {
  it("toglie la parentesi finale dell'università", () => {
    expect(cleanName("Mogno Samuele (Student DES 25)")).toBe("Mogno Samuele");
  });

  it("non tocca un soprannome fra parentesi in mezzo al nome", () => {
    expect(cleanName("Anna (Nina) Rossi")).toBe("Anna (Nina) Rossi");
  });

  it("non fa niente su un nome senza parentesi", () => {
    expect(cleanName("Mario Rossi")).toBe("Mario Rossi");
  });
});

describe("splitName", () => {
  it("taglia al primo spazio, cognome davanti al secondo pezzo", () => {
    expect(splitName("Mario De Luca")).toEqual({
      firstName: "Mario",
      lastName: "De Luca",
    });
  });

  it("nome vuoto per il cognome quando c'è una sola parola", () => {
    expect(splitName("Mario")).toEqual({ firstName: "Mario", lastName: "" });
  });

  it("ripulisce la parentesi dell'università prima di dividere", () => {
    expect(splitName("Mario Rossi (Student DES 25)")).toEqual({
      firstName: "Mario",
      lastName: "Rossi",
    });
  });
});

describe("givenNameLast", () => {
  it("prende l'ultima parola come nome, il resto come cognome", () => {
    expect(givenNameLast("Mogno Samuele")).toEqual({
      firstName: "Samuele",
      lastName: "Mogno",
    });
  });

  it("regge un cognome composto", () => {
    expect(givenNameLast("De Luca Mario")).toEqual({
      firstName: "Mario",
      lastName: "De Luca",
    });
  });

  it("nome vuoto per il cognome quando c'è una sola parola", () => {
    expect(givenNameLast("Samuele")).toEqual({ firstName: "Samuele", lastName: "" });
  });
});

describe("fullNameOf / displayNameOf / fullLabelOf", () => {
  it("fullNameOf unisce nome e cognome", () => {
    expect(fullNameOf({ name: "ignorato", firstName: "Mario", lastName: "Rossi" })).toBe(
      "Mario Rossi"
    );
  });

  it("fullNameOf ripiega su name quando mancano firstName/lastName", () => {
    expect(fullNameOf({ name: "mario@example.com" })).toBe("mario@example.com");
  });

  it("displayNameOf preferisce l'alias", () => {
    expect(
      displayNameOf({ name: "x", firstName: "Mario", lastName: "Rossi", alias: "Vale" })
    ).toBe("Vale");
  });

  it("displayNameOf ripiega sul nome per esteso senza alias", () => {
    expect(displayNameOf({ name: "x", firstName: "Mario", lastName: "Rossi" })).toBe(
      "Mario Rossi"
    );
  });

  it("hasSeparateFullName è vero solo quando alias e nome per esteso differiscono", () => {
    const withAlias = { name: "x", firstName: "Mario", lastName: "Rossi", alias: "Vale" };
    const withoutAlias = { name: "x", firstName: "Mario", lastName: "Rossi" };
    expect(hasSeparateFullName(withAlias)).toBe(true);
    expect(hasSeparateFullName(withoutAlias)).toBe(false);
  });

  it("fullLabelOf mette alias e nome per esteso fra parentesi", () => {
    expect(
      fullLabelOf({ name: "x", firstName: "Mario", lastName: "Rossi", alias: "Vale" })
    ).toBe("Vale (Mario Rossi)");
  });

  it("fullLabelOf senza alias è solo il nome per esteso, senza parentesi", () => {
    expect(fullLabelOf({ name: "x", firstName: "Mario", lastName: "Rossi" })).toBe(
      "Mario Rossi"
    );
  });
});

describe("isUploadedAvatar", () => {
  it("vero per una foto nostra", () => {
    expect(isUploadedAvatar("/uploads/abc123.jpg")).toBe(true);
  });

  it("falso per una foto esterna (Google)", () => {
    expect(isUploadedAvatar("https://lh3.googleusercontent.com/a/foo")).toBe(false);
  });

  it("falso quando manca", () => {
    expect(isUploadedAvatar(null)).toBe(false);
    expect(isUploadedAvatar(undefined)).toBe(false);
  });
});
