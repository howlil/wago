import { afterEach, describe, expect, it, vi } from "vitest";

describe("WhatsApp feature API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("starts pairing through the WhatsApp feature endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ success: true, message: "Pairing started", status: "qr" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    const { pairWhatsApp } = await import("../src/features/whatsapp/api.js");
    await expect(pairWhatsApp()).resolves.toEqual({ success: true, message: "Pairing started", status: "qr" });
    expect(fetch).toHaveBeenCalledWith("/whatsapp/pair", { method: "POST", credentials: "include" });
  });
});
