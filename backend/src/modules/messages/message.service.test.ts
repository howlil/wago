import { describe, expect, it, vi } from "vitest";
import { createMessageService } from "./message.service.js";

describe("message service", () => {
  it("creates a canonical Wago message id before delegating to the transport", async () => {
    const sendText = vi.fn().mockResolvedValue({ messageId: "trace-1", status: "pending" as const });
    const service = createMessageService({ sendText, getStatus: vi.fn() }, { createMessageId: () => "trace-1" });

    const result = await service.send({ to: "6281234567890", text: "Hello", idempotencyKey: "idem-1" });

    expect(result).toEqual({ messageId: "trace-1", status: "pending" });
    expect(sendText).toHaveBeenCalledWith("6281234567890", "Hello", {
      idempotencyKey: "idem-1",
      messageId: "trace-1",
    });
  });

  it("returns a sanitized diagnostic snapshot with webhook state", () => {
    const getStatus = vi.fn(() => ({
      id: "trace-1",
      to: "6281234567890@s.whatsapp.net",
      status: "accepted" as const,
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
      getStatus,
      getWebhookDelivery,
    });

    expect(service.findDiagnostic("trace-1")).toEqual({
      id: "trace-1",
      status: "accepted",
      createdAt: "2026-08-30T12:00:00.000Z",
      updatedAt: "2026-08-30T12:00:01.000Z",
      acceptedAt: "2026-08-30T12:00:01.000Z",
      webhook: getWebhookDelivery(),
    });
  });
});
