import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, requestJson } from "./client.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API client", () => {
  it("throws a stable ApiError for non-success JSON responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(403, {
          success: false,
          error: "RECIPIENT_NOT_ALLOWED",
          message: "Recipient is not allowed",
        }),
      ),
    );

    const promise = requestJson("/messages/send");

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({
      success: false,
      status: 403,
      code: "RECIPIENT_NOT_ALLOWED",
      error: "RECIPIENT_NOT_ALLOWED",
      message: "Recipient is not allowed",
    });
  });

  it("returns an explicitly allowed non-success status for readiness inspection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(503, { status: "not_ready", checks: {} })));

    await expect(requestJson("/ready", undefined, { allowedStatuses: [503] })).resolves.toEqual({
      status: "not_ready",
      checks: {},
    });
  });

  it("rejects non-JSON responses with a typed error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("bad gateway", {
          status: 502,
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );

    await expect(requestJson("/messages/send")).rejects.toMatchObject({
      status: 502,
      code: "NON_JSON_RESPONSE",
      message: "bad gateway",
    });
  });
});
