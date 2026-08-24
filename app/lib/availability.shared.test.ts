import { describe, expect, it } from "vitest";
import { isUpcomingSoon, UPCOMING_NOTE_DAYS } from "~/lib/availability.shared";

describe("isUpcomingSoon", () => {
  const today = "2026-08-24";

  it("vero per oggi stesso", () => {
    expect(isUpcomingSoon("2026-08-24", today)).toBe(true);
  });

  it("vero esattamente al limite dei giorni", () => {
    const limit = new Date(`${today}T00:00:00.000Z`);
    limit.setUTCDate(limit.getUTCDate() + UPCOMING_NOTE_DAYS);
    expect(isUpcomingSoon(limit, today)).toBe(true);
  });

  it("falso il giorno subito dopo il limite", () => {
    const pastLimit = new Date(`${today}T00:00:00.000Z`);
    pastLimit.setUTCDate(pastLimit.getUTCDate() + UPCOMING_NOTE_DAYS + 1);
    expect(isUpcomingSoon(pastLimit, today)).toBe(false);
  });

  it("vero per una data già passata (non è compito suo escluderla)", () => {
    expect(isUpcomingSoon("2026-08-20", today)).toBe(true);
  });
});
