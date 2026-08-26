import { afterEach, describe, expect, it, vi } from "vitest";

describe("settings feature API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("updates webhook settings through the settings resource", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: true,
              enabled: true,
              url: "https://example.com/hook",
              secretConfigured: true,
              rotationPending: false,
              updatedAt: "2026-08-14T00:00:00.000Z",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );

    const { updateWebhookSettings } = await import("../src/features/settings/api.js");
    await updateWebhookSettings({ enabled: true, url: "https://example.com/hook" });

    expect(fetch).toHaveBeenCalledWith("/webhooks/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true, url: "https://example.com/hook" }),
      credentials: "include",
    });
  });

  it("sends webhook tests through the dedicated dashboard endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: true,
              delivery: {
                id: "11111111-1111-4111-8111-111111111111",
                event: "wago.test",
                status: "delivered",
                lastStatusCode: 204,
                lastErrorCode: null,
              },
            }),
            { status: 202, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );

    const { sendWebhookTest } = await import("../src/features/settings/api.js");
    await sendWebhookTest();

    expect(fetch).toHaveBeenCalledWith("/webhooks/test", {
      method: "POST",
      credentials: "include",
    });
  });
});
