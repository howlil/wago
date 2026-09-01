import { describe, expect, it, vi } from "vitest";
import type { StoredWebhookDelivery } from "./delivery-store.js";
import { createWebhookDeliveryWorker } from "./delivery-worker.js";

function delivery(id = "delivery-1"): StoredWebhookDelivery {
  return {
    id,
    schemaVersion: 1,
    event: "message.server_accepted",
    messageId: `message-${id}`,
    payloadJson: "{}",
    status: "delivering",
    attemptCount: 0,
    redeliveryCount: 0,
    nextAttemptAt: 0,
    firstAttemptAt: null,
    lastAttemptAt: null,
    lastStatusCode: null,
    lastErrorCode: null,
    createdAt: 0,
    deliveredAt: null,
    expiresAt: 100_000,
    claimedAt: 0,
  };
}

describe("webhook delivery worker", () => {
  it("processes claimed deliveries and records the attempt result", async () => {
    const claimed = delivery();
    const completed = { ...claimed, status: "delivered" as const, attemptCount: 1, lastStatusCode: 204 };
    const expireDue = vi.fn(() => 0);
    const claimDue = vi.fn(() => [claimed]);
    const completeAttempt = vi.fn(() => completed);
    const pruneTerminal = vi.fn(() => 0);
    const send = vi.fn(async () => ({ ok: true as const, statusCode: 204 }));
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const worker = createWebhookDeliveryWorker({
      store: { expireDue, claimDue, completeAttempt, pruneTerminal },
      sender: { send },
      logger,
      now: () => 10_000,
      random: () => 0.5,
    });

    await worker.tick();

    expect(expireDue).toHaveBeenCalledWith(10_000);
    expect(pruneTerminal).toHaveBeenCalledWith(10_000);
    expect(claimDue).toHaveBeenCalledWith(10_000, 10);
    expect(send).toHaveBeenCalledWith(claimed);
    expect(completeAttempt).toHaveBeenCalledWith(
      "delivery-1",
      { ok: true, statusCode: 204 },
      10_000,
      expect.any(Function),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: "webhook.delivery.succeeded", deliveryId: "delivery-1" }),
      "Webhook delivery succeeded",
    );
  });

  it("resolves the active sender again for a later batch", async () => {
    const firstDelivery = delivery("delivery-1");
    const secondDelivery = delivery("delivery-2");
    const claimDue = vi.fn().mockReturnValueOnce([firstDelivery]).mockReturnValueOnce([secondDelivery]);
    const completeAttempt = vi.fn((id: string) => ({
      ...(id === firstDelivery.id ? firstDelivery : secondDelivery),
      status: "delivered" as const,
      attemptCount: 1,
      lastStatusCode: 204,
    }));
    const firstSend = vi.fn(async () => ({ ok: true as const, statusCode: 204 }));
    const secondSend = vi.fn(async () => ({ ok: true as const, statusCode: 204 }));
    let activeSender = { send: firstSend };

    const worker = createWebhookDeliveryWorker({
      store: { claimDue, completeAttempt, pruneTerminal: () => 0 },
      getSender: () => activeSender,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      now: () => 10_000,
    });

    await worker.tick();
    activeSender = { send: secondSend };
    await worker.tick();

    expect(firstSend).toHaveBeenCalledTimes(1);
    expect(firstSend).toHaveBeenCalledWith(firstDelivery);
    expect(secondSend).toHaveBeenCalledTimes(1);
    expect(secondSend).toHaveBeenCalledWith(secondDelivery);
  });

  it("expires due deliveries without claiming them while runtime webhook delivery is disabled", async () => {
    const expireDue = vi.fn(() => 1);
    const claimDue = vi.fn(() => [delivery()]);
    const worker = createWebhookDeliveryWorker({
      store: {
        expireDue,
        claimDue,
        completeAttempt: () => null,
        pruneTerminal: () => 0,
      },
      getSender: () => null,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      now: () => 10_000,
    });

    await worker.tick();

    expect(expireDue).toHaveBeenCalledWith(10_000);
    expect(claimDue).not.toHaveBeenCalled();
  });

  it("prunes terminal history only at the configured cadence", async () => {
    let nowMs = 1_000;
    const pruneTerminal = vi.fn(() => 0);
    const worker = createWebhookDeliveryWorker({
      store: {
        claimDue: () => [],
        completeAttempt: () => null,
        pruneTerminal,
      },
      sender: { send: async () => ({ ok: true, statusCode: 204 }) },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      now: () => nowMs,
      pruneIntervalMs: 60_000,
    });

    await worker.tick();
    nowMs += 30_000;
    await worker.tick();
    nowMs += 31_000;
    await worker.tick();

    expect(pruneTerminal).toHaveBeenCalledTimes(2);
  });
});
