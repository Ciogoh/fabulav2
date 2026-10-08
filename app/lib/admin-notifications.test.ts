import { describe, expect, it } from "vitest";
import { selectAdminNotificationRecipients } from "~/lib/admin-notifications";

const admins = [
  { email: "selected@example.com", receivesAdminNotifications: true, notifyChannel: "EMAIL" },
  { email: "excluded@example.com", receivesAdminNotifications: false, notifyChannel: "BOTH" },
];

describe("destinatari degli avvisi admin", () => {
  it("seleziona i destinatari mantenendo la loro preferenza di canale", () => {
    const before = structuredClone(admins);
    expect(selectAdminNotificationRecipients(admins, "")).toEqual({
      people: [admins[0]],
      extras: [],
    });
    expect(admins).toEqual(before);
  });

  it("ADMIN_EMAILS non aggira lo switch spento, anche con maiuscole e spazi", () => {
    expect(selectAdminNotificationRecipients(
      admins,
      " EXCLUDED@EXAMPLE.COM , SELECTED@example.com, shared@example.com",
    )).toEqual({ people: [admins[0]], extras: ["shared@example.com"] });
  });

  it("permette di escludere tutti gli admin senza riattivarli dalla lista aggiuntiva", () => {
    const excluded = admins.map((admin) => ({ ...admin, receivesAdminNotifications: false }));
    expect(selectAdminNotificationRecipients(excluded, "selected@example.com,excluded@example.com"))
      .toEqual({ people: [], extras: [] });
  });

  it("mantiene le caselle aggiuntive una volta sola e ignora gli indirizzi vuoti", () => {
    expect(selectAdminNotificationRecipients(admins, " , shared@example.com,,SHARED@example.com, other@example.com, "))
      .toEqual({ people: [admins[0]], extras: ["shared@example.com", "other@example.com"] });
  });

  it("mantiene le caselle aggiuntive anche senza admin registrati", () => {
    expect(selectAdminNotificationRecipients([], "shared@example.com"))
      .toEqual({ people: [], extras: ["shared@example.com"] });
  });
});
