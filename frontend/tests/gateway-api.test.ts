import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("gateway API", () => {
  beforeEach(() => {
    vi.resetModules();
    window.sessionStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ success: true, authenticated: true, message: "Signed in" }), {
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

  it("exchanges an admin password for an HttpOnly browser session without persisting it in browser storage", async () => {
    const { createBrowserSession } = await import("../src/features/gateway/api.js");
    await createBrowserSession("admin-test-secret");

    expect(fetch).toHaveBeenCalledWith("/app/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "admin-test-secret" }),
      credentials: "include",
    });
    expect(window.sessionStorage.length).toBe(0);
  });

  it("rejects a malformed JSON readiness response even when 503 is allowed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "upstream_unavailable" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const { getReadiness } = await import("../src/features/gateway/api.js");
    await expect(getReadiness()).rejects.toMatchObject({
      success: false,
      status: 0,
      code: "INVALID_READINESS_RESPONSE",
      error: "INVALID_READINESS_RESPONSE",
      message: "Readiness endpoint returned an invalid JSON payload",
      body: { error: "upstream_unavailable" },
    });
  });
});
