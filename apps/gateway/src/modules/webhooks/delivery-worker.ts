import type { StoredWebhookDelivery } from "./delivery-store.js";
import type { WebhookAttemptResult } from "./delivery-webhook-core.js";

export type WebhookDeliveryWorkerStore = {
  expireDue?(nowMs: number): number;
  claimDue(nowMs: number, limit?: number): StoredWebhookDelivery[];
  completeAttempt(
    id: string,
    result: WebhookAttemptResult,
    nowMs: number,
    random?: () => number,
  ): StoredWebhookDelivery | null;
  recoverInterrupted?(nowMs: number): number;
  pruneTerminal(nowMs: number): number;
};

export type WebhookAttemptSender = {
  send(delivery: Pick<StoredWebhookDelivery, "id" | "event" | "payloadJson">): Promise<WebhookAttemptResult>;
};

type WebhookWorkerLogger = {
  info(fields: Record<string, unknown>, message?: string): void;
  warn(fields: Record<string, unknown>, message?: string): void;
  error(fields: Record<string, unknown>, message?: string): void;
};

type WebhookDeliveryWorkerDependencies = {
  store: WebhookDeliveryWorkerStore;
  sender?: WebhookAttemptSender;
  getSender?: () => WebhookAttemptSender | null;
  logger: WebhookWorkerLogger;
  now?: () => number;
  random?: () => number;
  intervalMs?: number;
  batchSize?: number;
  pruneIntervalMs?: number;
};

const DEFAULT_INTERVAL_MS = 1_000;
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_PRUNE_INTERVAL_MS = 60 * 60 * 1_000;

export function createWebhookDeliveryWorker(deps: WebhookDeliveryWorkerDependencies) {
  const now = deps.now ?? Date.now;
  const random = deps.random ?? Math.random;
  const intervalMs = deps.intervalMs ?? DEFAULT_INTERVAL_MS;
  const batchSize = deps.batchSize ?? DEFAULT_BATCH_SIZE;
  const pruneIntervalMs = deps.pruneIntervalMs ?? DEFAULT_PRUNE_INTERVAL_MS;
  let timer: NodeJS.Timeout | undefined;
  let inFlight: Promise<void> | undefined;
  let nextPruneAt = 0;

  function resolveSender(): WebhookAttemptSender | null {
    return deps.getSender?.() ?? deps.sender ?? null;
  }

  async function processBatch(): Promise<void> {
    const batchNow = now();
    deps.store.expireDue?.(batchNow);

    if (batchNow >= nextPruneAt) {
      const deletedCount = deps.store.pruneTerminal(batchNow);
      nextPruneAt = batchNow + pruneIntervalMs;
      if (deletedCount > 0) {
        deps.logger.info(
          { event: "webhook.delivery.pruned", deletedCount },
          "Expired webhook delivery history was pruned",
        );
      }
    }

    const sender = resolveSender();
    if (!sender) {
      return;
    }

    const deliveries = deps.store.claimDue(batchNow, batchSize);

    for (const delivery of deliveries) {
      let result: WebhookAttemptResult;
      try {
        result = await sender.send(delivery);
      } catch (error) {
        result = {
          ok: false,
          retryable: true,
          statusCode: null,
          errorCode: "WEBHOOK_NETWORK_ERROR",
        };
        deps.logger.error(
          {
            event: "webhook.delivery.unexpected_sender_error",
            deliveryId: delivery.id,
            webhookEvent: delivery.event,
            errorType: error instanceof Error ? error.name : typeof error,
          },
          "Webhook attempt sender failed unexpectedly",
        );
      }

      const updated = deps.store.completeAttempt(delivery.id, result, now(), random);
      if (!updated) {
        continue;
      }

      const fields = {
        deliveryId: updated.id,
        messageId: updated.messageId,
        webhookEvent: updated.event,
        attemptCount: updated.attemptCount,
        statusCode: updated.lastStatusCode,
        errorCode: updated.lastErrorCode,
      };

      if (updated.status === "delivered") {
        deps.logger.info({ event: "webhook.delivery.succeeded", ...fields }, "Webhook delivery succeeded");
      } else if (updated.status === "pending") {
        deps.logger.warn(
          {
            event: "webhook.delivery.retry_scheduled",
            ...fields,
            nextAttemptAt: updated.nextAttemptAt,
          },
          "Webhook delivery retry scheduled",
        );
      } else if (updated.status === "expired") {
        deps.logger.error({ event: "webhook.delivery.expired", ...fields }, "Webhook delivery expired");
      } else if (updated.status === "failed") {
        deps.logger.error({ event: "webhook.delivery.failed", ...fields }, "Webhook delivery failed permanently");
      }
    }
  }

  function tick(): Promise<void> {
    if (inFlight) {
      return inFlight;
    }

    inFlight = processBatch().finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  }

  function start(): void {
    if (timer) {
      return;
    }

    const recoveredCount = deps.store.recoverInterrupted?.(now()) ?? 0;
    if (recoveredCount > 0) {
      deps.logger.warn(
        { event: "webhook.delivery.recovered", recoveredCount },
        "Interrupted webhook attempts were recovered for retry",
      );
    }

    void tick();
    timer = setInterval(() => {
      void tick();
    }, intervalMs);
    timer.unref();
  }

  async function stop(): Promise<void> {
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }

    await inFlight;
  }

  return {
    start,
    stop,
    tick,
  };
}
