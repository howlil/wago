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
});
