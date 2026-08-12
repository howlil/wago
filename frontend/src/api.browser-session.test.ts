import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("browser authentication API client", () => {
  beforeEach(() => {
    vi.resetModules();
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
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("exchanges an API key for an HttpOnly browser session without touching browser storage", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const removeItem = vi.spyOn(Storage.prototype, "removeItem");
    const { createBrowserSession } = await import("./api.js");

    await createBrowserSession("wa_existing_secret");

    expect(fetch).toHaveBeenCalledWith(
      "/app/session",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ apiKey: "wa_existing_secret" }),
      }),
    );
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });
});
