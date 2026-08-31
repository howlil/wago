import { describe, expect, it, vi } from "vitest";
import { createWebhookDeliveryWorker } from "./delivery-worker.js";

describe("webhook delivery worker recovery", () => {
  it("recovers interrupted attempts before the first delivery batch", async () => {
    const events: string[] = [];
    const recoverInterrupted = vi.fn(() => {
      events.push("recover");
      return 2;
    });
    const claimDue = vi.fn(() => {
      events.push("claim");
      return [];
    });
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const worker = createWebhookDeliveryWorker({
      store: {
        recoverInterrupted,
        claimDue,
        completeAttempt: () => null,
        pruneTerminal: () => 0,
      },
      sender: { send: async () => ({ ok: true, statusCode: 204 }) },
      logger,
      now: () => 10_000,
      intervalMs: 60_000,
    });

    worker.start();
    await worker.tick();
    await worker.stop();

    expect(events[0]).toBe("recover");
    expect(recoverInterrupted).toHaveBeenCalledWith(10_000);
    expect(logger.warn).toHaveBeenCalledWith(
      { event: "webhook.delivery.recovered", recoveredCount: 2 },
      "Interrupted webhook attempts were recovered for retry",
    );
  });
});
