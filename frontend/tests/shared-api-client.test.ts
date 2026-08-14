import { afterEach, describe, expect, it, vi } from "vitest";

describe("shared HTTP client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends same-origin requests with browser credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    const { requestJson } = await import("../src/shared/api/client.js");
    await expect(requestJson<{ success: boolean }>("/health")).resolves.toEqual({ success: true });
    expect(fetch).toHaveBeenCalledWith("/health", { credentials: "include" });
  });

  it("normalizes non-JSON HTTP failures before throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Bad Gateway", { status: 502 })));

    const { requestJson } = await import("../src/shared/api/client.js");
    await expect(requestJson("/health")).rejects.toEqual({
      success: false,
      error: "NON_JSON_RESPONSE",
      message: "Bad Gateway",
    });
  });
});
