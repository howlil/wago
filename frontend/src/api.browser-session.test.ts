import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("browser authentication API client", () => {
  beforeEach(() => {
    vi.resetModules();
    window.sessionStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ success: true, authenticated: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
  });

  afterEach(() => {
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("exchanges an API key for an HttpOnly browser session without persisting it in browser storage", async () => {
    window.sessionStorage.setItem("wago.apiKey", "wa_legacy_secret");
    const { createBrowserSession } = await import("./api.js");

    expect(window.sessionStorage.getItem("wago.apiKey")).toBeNull();

    await createBrowserSession("wa_existing_secret");

    expect(fetch).toHaveBeenCalledWith(
      "/app/session",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ apiKey: "wa_existing_secret" }),
      }),
    );
    expect(window.sessionStorage.getItem("wago.apiKey")).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });
});
