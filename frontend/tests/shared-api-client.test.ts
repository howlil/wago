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

  it("accepts an explicitly allowed non-2xx status as a valid JSON response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ status: "not_ready" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    const { requestJson } = await import("../src/shared/api/client.js");
    await expect(requestJson<{ status: string }>("/ready", undefined, { allowedStatuses: [503] })).resolves.toEqual({
      status: "not_ready",
    });
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
