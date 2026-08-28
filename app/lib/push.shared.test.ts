import { describe, expect, it } from "vitest";
import { deviceLabel } from "~/lib/push.shared";

describe("deviceLabel", () => {
  it("riconosce un telefono Android con Chrome", () => {
    expect(
      deviceLabel(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
      )
    ).toBe("Chrome · Android");
  });

  /* Le tre bugie storiche, una per riga: sono la ragione per cui l'ordine dei
     controlli è al contrario. Se qualcuno un giorno lo "sistema" mettendo
     Safari per primo, questi tre test cadono insieme. */
  it("non chiama Safari un Chrome, né Chrome un Edge", () => {
    expect(
      deviceLabel(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"
      )
    ).toBe("Safari · macOS");

    expect(
      deviceLabel(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0"
      )
    ).toBe("Edge · Windows");

    expect(
      deviceLabel(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.0.0 Mobile/15E148 Safari/604.1"
      )
    ).toBe("Chrome · iOS");
  });

  it("dice di non sapere invece di indovinare", () => {
    expect(deviceLabel(null)).toBeNull();
    expect(deviceLabel("curl/8.4.0")).toBeNull();
  });
});
