import { afterEach, describe, expect, it, vi } from "vitest";

describe("messages feature API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends a message with the provided idempotency key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ success: true, messageId: "message-1", status: "pending" }), {
            status: 202,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    const { sendMessage } = await import("../src/features/messages/api.js");
    await expect(sendMessage("6281234567890", "Hello", "idem-1")).resolves.toEqual({
      success: true,
      messageId: "message-1",
      status: "pending",
    });
    expect(fetch).toHaveBeenCalledWith("/messages/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "idem-1",
      },
      body: JSON.stringify({ to: "6281234567890", text: "Hello" }),
      credentials: "include",
    });
  });

  it("reads the sanitized durable message diagnostic endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: true,
              id: "message-1",
              status: "accepted",
              dispatchState: "submitted",
              createdAt: "2026-08-30T12:00:00.000Z",
              updatedAt: "2026-08-30T12:00:01.000Z",
              acceptedAt: "2026-08-30T12:00:01.000Z",
              webhook: null,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );

    const { getMessageDiagnostics } = await import("../src/features/messages/api.js");
    await expect(getMessageDiagnostics("message/1")).resolves.toMatchObject({
      id: "message-1",
      status: "accepted",
      dispatchState: "submitted",
      webhook: null,
    });
    expect(fetch).toHaveBeenCalledWith("/messages/message%2F1", {
      credentials: "include",
    });
  });
});
