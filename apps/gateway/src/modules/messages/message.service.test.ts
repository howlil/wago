import { describe, expect, it, vi } from "vitest";
import { createMessageService } from "./message.service.js";

function dependencies() {
  return {
    sendText: vi.fn().mockResolvedValue({ messageId: "trace-1", status: "pending" as const }),
    sendMedia: vi.fn().mockResolvedValue({ messageId: "trace-1", status: "pending" as const }),
    downloadInboundMedia: vi.fn(),
    getStatus: vi.fn(),
  };
}

describe("message service", () => {
  it("creates a canonical Wago message id before delegating to the transport", async () => {
    const deps = dependencies();
    const service = createMessageService(deps, { createMessageId: () => "trace-1" });

    const result = await service.send({ to: "6281234567890", text: "Hello", idempotencyKey: "idem-1" });

    expect(result).toEqual({ messageId: "trace-1", status: "pending" });
    expect(deps.sendText).toHaveBeenCalledWith("6281234567890", "Hello", {
      idempotencyKey: "idem-1",
      messageId: "trace-1",
    });
  });

  it("passes bounded reply context without changing legacy sends", async () => {
    const deps = dependencies();
    const service = createMessageService(deps, { createMessageId: () => "trace-reply" });

    await service.send({ to: "6281234567890", text: "Reply", replyToMessageId: "in_123" });

    expect(deps.sendText).toHaveBeenCalledWith("6281234567890", "Reply", {
      messageId: "trace-reply",
      replyToMessageId: "in_123",
    });
  });

  it("delegates binary media and ephemeral inbound downloads", async () => {
    const deps = dependencies();
    const service = createMessageService(deps, { createMessageId: () => "trace-media" });
    const data = Buffer.from("image-bytes");
    deps.downloadInboundMedia.mockResolvedValue({ data, media: { kind: "image", mimetype: "image/png" } });

    await service.sendMedia({
      to: "6281234567890",
      kind: "image",
      data,
      mimetype: "image/png",
      caption: "proof",
      replyToMessageId: "in_media",
    });
    await expect(service.downloadInboundMedia("in_media")).resolves.toEqual({
      data,
      media: { kind: "image", mimetype: "image/png" },
    });

    expect(deps.sendMedia).toHaveBeenCalledWith(
      "6281234567890",
      { kind: "image", data, mimetype: "image/png", caption: "proof" },
      { messageId: "trace-media", replyToMessageId: "in_media" },
    );
  });

  it("returns a sanitized diagnostic snapshot with transport and webhook state", () => {
    const getStatus = vi.fn(() => ({
      id: "trace-1",
      to: "6281234567890@s.whatsapp.net",
      status: "accepted" as const,
      dispatchState: "submitted" as const,
      createdAt: "2026-08-30T12:00:00.000Z",
      updatedAt: "2026-08-30T12:00:01.000Z",
      acceptedAt: "2026-08-30T12:00:01.000Z",
    }));
    const getWebhookDelivery = vi.fn(() => ({
      id: "delivery-1",
      event: "message.accepted",
      status: "delivered",
      attemptCount: 1,
      redeliveryCount: 0,
      lastStatusCode: 200,
      lastErrorCode: null,
      createdAt: "2026-08-30T12:00:01.000Z",
      lastAttemptAt: "2026-08-30T12:00:02.000Z",
      deliveredAt: "2026-08-30T12:00:02.000Z",
    }));
    const service = createMessageService({
      sendText: vi.fn(),
      sendMedia: vi.fn(),
      downloadInboundMedia: vi.fn(),
      getStatus,
      getWebhookDelivery,
    });

    expect(service.findDiagnostic("trace-1")).toEqual({
      id: "trace-1",
      status: "accepted",
      dispatchState: "submitted",
      createdAt: "2026-08-30T12:00:00.000Z",
      updatedAt: "2026-08-30T12:00:01.000Z",
      acceptedAt: "2026-08-30T12:00:01.000Z",
      webhook: getWebhookDelivery(),
    });
  });
});
