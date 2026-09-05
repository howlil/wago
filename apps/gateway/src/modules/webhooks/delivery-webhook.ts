import { getDatabase } from "../../infrastructure/database.js";
import { logger } from "../../infrastructure/logger.js";
import { type ActivityMetadata, recordActivity } from "../activity/store.js";
import type { StoredWebhookDeliveryAttempt, WebhookAttemptOutcome } from "./delivery-attempt-store.js";
import {
  createWebhookDeliveryStore,
  type StoredWebhookDelivery,
  WEBHOOK_DELIVERY_HORIZON_MS,
  type WebhookDeliveryStatus,
} from "./delivery-store.js";
import {
  createIncomingMediaWebhookEnvelope,
  createIncomingMessageWebhookEnvelope,
  createMessageDeliveryWebhookEnvelope,
  createTestWebhookEnvelope,
  createWebhookAttemptSender,
  type IncomingMediaWebhookInput,
  type IncomingMessageWebhookInput,
  type MessageDeliveryWebhookInput,
  type WebhookEvent,
} from "./delivery-webhook-core.js";
import { createWebhookDeliveryWorker } from "./delivery-worker.js";
import { webhookSettingsStore as settingsStore } from "./settings-runtime.js";

const database = getDatabase();
const store = createWebhookDeliveryStore(database);
const selectLatestMessageDeliveryId = database.prepare(`
  SELECT id
  FROM webhook_deliveries
  WHERE message_id = ? AND event_type <> 'wago.test'
  ORDER BY created_at DESC
  LIMIT 1
`);

function currentAttemptSender() {
  const settings = settingsStore.get();
  if (!settings?.enabled || !settings.url || !settings.secret) return null;
  const secrets = [settings.secret, settings.previousSecret].filter((secret): secret is string => Boolean(secret));
  return createWebhookAttemptSender({ url: settings.url, secrets });
}

function lifecycleMetadata(fields: Record<string, unknown>): ActivityMetadata {
  const keys = ["deliveryId", "messageId", "webhookEvent", "attemptCount", "statusCode", "errorCode", "recoveredCount"];
  const metadata: ActivityMetadata = {};
  for (const key of keys) {
    const value = fields[key];
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean")
      metadata[key] = value;
  }
  return metadata;
}

function recordWorkerLifecycle(fields: Record<string, unknown>): void {
  const event = typeof fields.event === "string" ? fields.event : "";
  if (event === "webhook.delivery.failed") {
    void recordActivity({
      level: "error",
      category: "system",
      code: event,
      title: "Webhook delivery failed permanently",
      description: "Webhook delivery reached a non-retryable failure and requires operator review.",
      metadata: lifecycleMetadata(fields),
    });
  } else if (event === "webhook.delivery.expired") {
    void recordActivity({
      level: "error",
      category: "system",
      code: event,
      title: "Webhook delivery expired",
      description: "Webhook delivery exhausted its retry horizon without a successful callback.",
      metadata: lifecycleMetadata(fields),
    });
  } else if (event === "webhook.delivery.recovered") {
    void recordActivity({
      level: "warning",
      category: "system",
      code: event,
      title: "Interrupted webhook delivery recovered",
      description:
        "Webhook attempts left in progress by a previous process were marked interrupted and returned to retry.",
      metadata: lifecycleMetadata(fields),
    });
  }
}

const worker = createWebhookDeliveryWorker({
  store,
  getSender: currentAttemptSender,
  logger: {
    info: (fields, message) => logger.info(fields, message),
    warn: (fields, message) => {
      logger.warn(fields, message);
      recordWorkerLifecycle(fields);
    },
    error: (fields, message) => {
      logger.error(fields, message);
      recordWorkerLifecycle(fields);
    },
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
  redeliveryAvailable: boolean;
};

export type PublicWebhookAttempt = Omit<StoredWebhookDeliveryAttempt, "startedAt" | "completedAt" | "nextAttemptAt"> & {
  outcome: WebhookAttemptOutcome;
  startedAt: string;
  completedAt: string | null;
  nextAttemptAt: string | null;
};

export type PublicWebhookDeliveryDetail = PublicWebhookDelivery & { attempts: PublicWebhookAttempt[] };

function iso(timestamp: number | null): string | null {
  return timestamp == null ? null : new Date(timestamp).toISOString();
}

function isInboundEvent(event: WebhookEvent): boolean {
  return event === "message.received" || event === "message.media_received";
}

function serializeWebhookAttempt(attempt: StoredWebhookDeliveryAttempt): PublicWebhookAttempt {
  return {
    ...attempt,
    startedAt: new Date(attempt.startedAt).toISOString(),
    completedAt: iso(attempt.completedAt),
    nextAttemptAt: iso(attempt.nextAttemptAt),
  };
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
    redeliveryAvailable: !isInboundEvent(delivery.event),
  };
}

export function enqueueMessageDeliveryWebhook(input: MessageDeliveryWebhookInput): void {
  const settings = settingsStore.get();
  if (!settings?.enabled || !settings.url || !settings.secret) return;
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

function enqueueInboundEnvelope(input: IncomingMessageWebhookInput | IncomingMediaWebhookInput, media: boolean): void {
  const settings = settingsStore.get();
  if (!settings?.enabled || !settings.url || !settings.secret) return;
  try {
    const now = new Date();
    const envelope = media
      ? createIncomingMediaWebhookEnvelope(input as IncomingMediaWebhookInput, { now: () => now })
      : createIncomingMessageWebhookEnvelope(input as IncomingMessageWebhookInput, { now: () => now });
    const queued = store.enqueue(envelope, now.getTime() + WEBHOOK_DELIVERY_HORIZON_MS);
    if (queued.id === envelope.id) {
      void recordActivity({
        level: "info",
        category: "messaging",
        code: "webhook.inbound.queued",
        title: media ? "Incoming media webhook queued" : "Incoming message webhook queued",
        description: media
          ? "Direct incoming media metadata was queued for signed webhook delivery; media bytes remain ephemeral."
          : "A direct incoming text message was queued for signed webhook delivery.",
        metadata: { messageId: input.messageId, deliveryId: queued.id, webhookEvent: envelope.event },
      });
    }
    void worker.tick();
  } catch (error) {
    logger.error(
      {
        event: "webhook.enqueue_failed",
        messageId: input.messageId,
        webhookEvent: media ? "message.media_received" : "message.received",
        errorType: error instanceof Error ? error.name : typeof error,
      },
      "Could not persist incoming webhook delivery",
    );
  }
}

export function enqueueIncomingMessageWebhook(input: IncomingMessageWebhookInput): void {
  enqueueInboundEnvelope(input, false);
}

export function enqueueIncomingMediaWebhook(input: IncomingMediaWebhookInput): void {
  enqueueInboundEnvelope(input, true);
}

export async function sendTestWebhookDelivery(): Promise<
  { kind: "disabled" } | { kind: "queued"; delivery: PublicWebhookDelivery }
> {
  const settings = settingsStore.get();
  if (!settings?.enabled || !settings.url || !settings.secret) return { kind: "disabled" };
  const now = new Date();
  const envelope = createTestWebhookEnvelope({ now: () => now });
  const queued = store.enqueue(envelope, now.getTime() + WEBHOOK_DELIVERY_HORIZON_MS);
  await worker.tick();
  let current = store.get(envelope.id) ?? queued;
  if (current.status === "pending" && current.attemptCount === 0) {
    await worker.tick();
    current = store.get(envelope.id) ?? current;
  }
  return { kind: "queued", delivery: serializeWebhookDelivery(current) };
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

export function getWebhookDelivery(id: string): PublicWebhookDeliveryDetail | null {
  const delivery = store.get(id);
  return delivery
    ? { ...serializeWebhookDelivery(delivery), attempts: store.listAttempts(id, 50).map(serializeWebhookAttempt) }
    : null;
}

export function getMessageWebhookDelivery(messageId: string): PublicWebhookDelivery | null {
  const row = selectLatestMessageDeliveryId.get(messageId) as { id: string } | undefined;
  if (!row) return null;
  const delivery = store.get(row.id);
  return delivery ? serializeWebhookDelivery(delivery) : null;
}

export function redeliverWebhookDelivery(
  id: string,
):
  | { kind: "disabled" }
  | { kind: "not_found" }
  | { kind: "in_progress"; delivery: PublicWebhookDelivery }
  | { kind: "payload_unavailable"; delivery: PublicWebhookDelivery }
  | { kind: "queued"; delivery: PublicWebhookDelivery } {
  const settings = settingsStore.get();
  if (!settings?.enabled || !settings.url || !settings.secret) return { kind: "disabled" };
  const existing = store.get(id);
  if (!existing) return { kind: "not_found" };
  if (existing.status === "delivering") return { kind: "in_progress", delivery: serializeWebhookDelivery(existing) };
  if (isInboundEvent(existing.event))
    return { kind: "payload_unavailable", delivery: serializeWebhookDelivery(existing) };

  const result = store.redeliver(id, Date.now());
  if (result.kind === "not_found") return result;
  if (result.kind === "queued") {
    void recordActivity({
      level: "info",
      category: "system",
      code: "webhook.delivery.redelivered",
      title: "Webhook delivery redelivered",
      description: "An authenticated operator requested a new delivery cycle while preserving prior attempt evidence.",
      metadata: {
        deliveryId: result.delivery.id,
        messageId: result.delivery.messageId,
        webhookEvent: result.delivery.event,
        redeliveryCount: result.delivery.redeliveryCount,
      },
    });
    void worker.tick();
  }
  return { kind: result.kind, delivery: serializeWebhookDelivery(result.delivery) };
}
