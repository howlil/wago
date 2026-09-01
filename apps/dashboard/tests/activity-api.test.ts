import { afterEach, describe, expect, it, vi } from "vitest";

describe("activity feature API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("serializes bounded activity filters into the audit query", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ success: true, events: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    const { listActivity } = await import("../src/features/activity/api.js");
    const longQuery = `  ${"x".repeat(120)}  `;
    await listActivity({
      limit: 50,
      before: "cursor-1",
      source: "baileys",
      category: "connection",
      level: "warning",
      q: longQuery,
    });

    const expected = new URLSearchParams({
      limit: "50",
      before: "cursor-1",
      source: "baileys",
      category: "connection",
      level: "warning",
      q: "x".repeat(100),
    });
    expect(fetch).toHaveBeenCalledWith(`/activity?${expected.toString()}`, { credentials: "include" });
  });
});
