import { getDatabase } from "../infrastructure/database.js";
import { logger } from "../infrastructure/logger.js";
import {
  createWebhookDeliveryStore,
  type StoredWebhookDelivery,
  WEBHOOK_DELIVERY_HORIZON_MS,
  type WebhookDeliveryStatus,
} from "./delivery-store.js";
import {
  createMessageDeliveryWebhookEnvelope,
  createWebhookAttemptSender,
  type MessageDeliveryWebhookInput,
} from "./delivery-webhook-core.js";
import { createWebhookDeliveryWorker } from "./delivery-worker.js";
import { webhookSettingsStore as settingsStore } from "./settings-runtime.js";

const database = getDatabase();
const store = createWebhookDeliveryStore(database);

function currentAttemptSender() {
  const settings = settingsStore.get();
  if (!settings?.enabled || !settings.url || !settings.secret) {
    return null;
  }

  const secrets = [settings.secret, settings.previousSecret].filter((secret): secret is string => Boolean(secret));
  return createWebhookAttemptSender({ url: settings.url, secrets });
}

const worker = createWebhookDeliveryWorker({
  store,
  getSender: currentAttemptSender,
  logger: {
    info: (fields, message) => logger.info(fields, message),
    warn: (fields, message) => logger.warn(fields, message),
    error: (fields, message) => logger.error(fields, message),
  },
});

export type PublicWebhookDelivery = Omit<
  StoredWebhookDelivery,
  | "payloadJson"
  | "createdAt"
  | "firstAttemptAt"
  | "lastAttemptAt"
  | "nextAttemptAt"
  | "deliveredAt"
  | "expiresAt"
  | "claimedAt"
> & {
  createdAt: string;
  firstAttemptAt: string | null;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  deliveredAt: string | null;
  expiresAt: string;
  claimedAt: string | null;
};

function iso(timestamp: number | null): string | null {
  return timestamp == null ? null : new Date(timestamp).toISOString();
}

export function serializeWebhookDelivery(delivery: StoredWebhookDelivery): PublicWebhookDelivery {
  const { payloadJson: _payloadJson, ...safe } = delivery;
  return {
    ...safe,
    createdAt: new Date(delivery.createdAt).toISOString(),
    firstAttemptAt: iso(delivery.firstAttemptAt),
    lastAttemptAt: iso(delivery.lastAttemptAt),
    nextAttemptAt: iso(delivery.nextAttemptAt),
    deliveredAt: iso(delivery.deliveredAt),
    expiresAt: new Date(delivery.expiresAt).toISOString(),
    claimedAt: iso(delivery.claimedAt),
  };
}

export function enqueueMessageDeliveryWebhook(input: MessageDeliveryWebhookInput): void {
  const settings = settingsStore.get();
  if (!settings?.enabled || !settings.url || !settings.secret) {
    return;
  }

  try {
    const now = new Date();
    const envelope = createMessageDeliveryWebhookEnvelope(input, { now: () => now });
    store.enqueue(envelope, now.getTime() + WEBHOOK_DELIVERY_HORIZON_MS);
    void worker.tick();
  } catch (error) {
    logger.error(
      {
        event: "webhook.enqueue_failed",
        messageId: input.messageId,
        webhookStatus: input.status,
        errorType: error instanceof Error ? error.name : typeof error,
      },
      "Could not persist webhook delivery",
    );
  }
}

export function startWebhookDeliveryWorker(): void {
  worker.start();
}

export async function stopWebhookDeliveryWorker(): Promise<void> {
  await worker.stop();
}

export function listWebhookDeliveries(options: {
  status?: WebhookDeliveryStatus;
  limit?: number;
}): PublicWebhookDelivery[] {
  return store.list(options).map(serializeWebhookDelivery);
}

export function getWebhookDelivery(id: string): PublicWebhookDelivery | null {
  const delivery = store.get(id);
  return delivery ? serializeWebhookDelivery(delivery) : null;
}

export function redeliverWebhookDelivery(
  id: string,
):
  | { kind: "disabled" }
  | { kind: "not_found" }
  | { kind: "in_progress"; delivery: PublicWebhookDelivery }
  | { kind: "queued"; delivery: PublicWebhookDelivery } {
  const settings = settingsStore.get();
  if (!settings?.enabled || !settings.url || !settings.secret) {
    return { kind: "disabled" };
  }

  const result = store.redeliver(id, Date.now());
  if (result.kind === "not_found") {
    return result;
  }

  if (result.kind === "queued") {
    void worker.tick();
  }

  return {
    kind: result.kind,
    delivery: serializeWebhookDelivery(result.delivery),
  };
}
