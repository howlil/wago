import { afterEach, describe, expect, it, vi } from "vitest";
import { bootstrapApp } from "./api.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("bootstrap API client", () => {
  it("sends the one-time setup code through X-Wago-Setup-Code", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          appId: "wa-gateway-test",
          apiKey: "wa_test",
          recovered: false,
          sessionExpiresAt: new Date().toISOString(),
          message: "ok",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );

    await bootstrapApp("wa_test", "setup-code-value");

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.headers).toMatchObject({
      "X-Wago-Setup-Code": "setup-code-value",
    });
  });
});
