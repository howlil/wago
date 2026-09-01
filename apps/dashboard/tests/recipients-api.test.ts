import { afterEach, describe, expect, it, vi } from "vitest";

describe("recipients feature API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("allows a recipient with a trimmed optional label", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: true,
              recipient: {
                jid: "6281234567890@s.whatsapp.net",
                label: "Finance",
                allowed: true,
                optedOut: false,
                createdAt: "2026-08-10T00:00:00.000Z",
                updatedAt: "2026-08-10T00:00:00.000Z",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );

    const { allowRecipient } = await import("../src/features/recipients/api.js");
    await allowRecipient("6281234567890", "  Finance  ");

    expect(fetch).toHaveBeenCalledWith("/recipients/allow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "6281234567890", label: "Finance" }),
      credentials: "include",
    });
  });

  it("opts out the encoded recipient through the recipient resource endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: true,
              recipient: {
                jid: "6281234567890@s.whatsapp.net",
                allowed: false,
                optedOut: true,
                createdAt: "2026-08-10T00:00:00.000Z",
                updatedAt: "2026-08-14T00:00:00.000Z",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );

    const { optOutRecipient } = await import("../src/features/recipients/api.js");
    await optOutRecipient("+62 812/345");

    expect(fetch).toHaveBeenCalledWith("/recipients/%2B62%20812%2F345/opt-out", {
      method: "POST",
      credentials: "include",
    });
  });
});
