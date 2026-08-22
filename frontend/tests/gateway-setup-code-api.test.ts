import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("gateway setup-code API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ success: true, appId: "wago", apiKey: "wa_key", recovered: false }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends the one-time setup code with X-Wago-Setup-Code", async () => {
    const { bootstrapApp } = await import("../src/features/gateway/api.js");

    await bootstrapApp("wa_candidate", "setup_once");

    expect(fetch).toHaveBeenCalledWith("/app/bootstrap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Wago-Setup-Code": "setup_once",
      },
      body: JSON.stringify({ apiKey: "wa_candidate" }),
      credentials: "include",
    });
  });
});
