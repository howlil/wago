import { afterEach, describe, expect, it, vi } from "vitest";

function pendingResponse() {
  return new Response(JSON.stringify({ success: true, messageId: "message-1", status: "pending" }), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
}

describe("messages feature API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends a message with the provided idempotency key", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => pendingResponse()));

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

  it("sends a contextual reply with the canonical inbound message id", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => pendingResponse()));

    const { sendReplyMessage } = await import("../src/features/messages/api.js");
    await sendReplyMessage("6281234567890", "Reply", "in_123", "idem-reply");

    expect(fetch).toHaveBeenCalledWith("/messages/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "idem-reply",
      },
      body: JSON.stringify({ to: "6281234567890", text: "Reply", replyToMessageId: "in_123" }),
      credentials: "include",
    });
  });

  it("sends media bytes directly and can download recent inbound media", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(pendingResponse())
      .mockResolvedValueOnce(
        new Response("downloaded", {
          status: 200,
          headers: { "Content-Type": "image/png" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { downloadInboundMedia, sendMediaMessage } = await import("../src/features/messages/api.js");
    await sendMediaMessage({
      to: "6281234567890",
      kind: "image",
      data: new Blob(["image"], { type: "image/png" }),
      mimetype: "image/png",
      caption: "proof",
      fileName: "proof.png",
      replyToMessageId: "in_123",
      idempotencyKey: "idem-media",
    });
    const downloaded = await downloadInboundMedia("in/media");

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/messages/send-media");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "image/png",
        "Idempotency-Key": "idem-media",
        "X-Wago-To": "6281234567890",
        "X-Wago-Media-Kind": "image",
        "X-Wago-Caption": "proof",
        "X-Wago-Filename": "proof.png",
        "X-Wago-Reply-To": "in_123",
      },
      credentials: "include",
    });
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBeInstanceOf(Blob);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/messages/incoming/in%2Fmedia/media");
    await expect(downloaded.text()).resolves.toBe("downloaded");
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
