import type { DatabaseSync } from "node:sqlite";
import { withTransaction } from "../../infrastructure/database/transaction.js";
import type { WebhookAttemptResult, WebhookEnvelope, WebhookEvent } from "./delivery-webhook-core.js";
import { serializeWebhookEnvelope } from "./delivery-webhook-core.js";

export const WEBHOOK_DELIVERY_HORIZON_MS = 24 * 60 * 60 * 1_000;
export const WEBHOOK_CLAIM_TIMEOUT_MS = 60_000;
export const WEBHOOK_DELIVERY_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

const RETRY_BASE_DELAYS_MS = [5_000, 30_000, 120_000, 600_000, 1_800_000, 3_600_000, 10_800_000, 21_600_000] as const;

export type WebhookDeliveryStatus = "pending" | "delivering" | "delivered" | "failed" | "expired";

export type StoredWebhookDelivery = {
  id: string;
  schemaVersion: number;
  event: WebhookEvent;
  messageId: string;
  payloadJson: string;
  status: WebhookDeliveryStatus;
  attemptCount: number;
  redeliveryCount: number;
  nextAttemptAt: number | null;
  firstAttemptAt: number | null;
  lastAttemptAt: number | null;
  lastStatusCode: number | null;
  lastErrorCode: string | null;
  createdAt: number;
  deliveredAt: number | null;
  expiresAt: number;
  claimedAt: number | null;
};

type WebhookDeliveryRow = {
  id: string;
  schema_version: number;
  event_type: WebhookEvent;
  message_id: string;
  payload_json: string;
  status: WebhookDeliveryStatus;
  attempt_count: number;
  redelivery_count: number;
  next_attempt_at: number | null;
  first_attempt_at: number | null;
  last_attempt_at: number | null;
  last_status_code: number | null;
  last_error_code: string | null;
  created_at: number;
  delivered_at: number | null;
  expires_at: number;
  claimed_at: number | null;
};

export type WebhookRedeliveryResult =
  | { kind: "not_found" }
  | { kind: "in_progress"; delivery: StoredWebhookDelivery }
  | { kind: "queued"; delivery: StoredWebhookDelivery };

function mapRow(row: WebhookDeliveryRow): StoredWebhookDelivery {
  return {
    id: row.id,
    schemaVersion: row.schema_version,
    event: row.event_type,
    messageId: row.message_id,
    payloadJson: row.payload_json,
    status: row.status,
    attemptCount: row.attempt_count,
    redeliveryCount: row.redelivery_count,
    nextAttemptAt: row.next_attempt_at,
    firstAttemptAt: row.first_attempt_at,
    lastAttemptAt: row.last_attempt_at,
    lastStatusCode: row.last_status_code,
    lastErrorCode: row.last_error_code,
    createdAt: row.created_at,
    deliveredAt: row.delivered_at,
    expiresAt: row.expires_at,
    claimedAt: row.claimed_at,
  };
}

function clampRandom(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function getWebhookRetryDelayMs(attemptCount: number, random: () => number = Math.random): number {
  const index = Math.min(Math.max(attemptCount - 1, 0), RETRY_BASE_DELAYS_MS.length - 1);
  const baseDelay = RETRY_BASE_DELAYS_MS[index] ?? RETRY_BASE_DELAYS_MS[0];
  const jitterFactor = 0.8 + clampRandom(random()) * 0.4;
  return Math.floor(baseDelay * jitterFactor);
}

export function createWebhookDeliveryStore(database: DatabaseSync) {
  const selectById = database.prepare("SELECT * FROM webhook_deliveries WHERE id = ?");
  const selectByMessageEvent = database.prepare(
    "SELECT * FROM webhook_deliveries WHERE message_id = ? AND event_type = ?",
  );

  function get(id: string): StoredWebhookDelivery | null {
    const row = selectById.get(id) as WebhookDeliveryRow | undefined;
    return row ? mapRow(row) : null;
  }

  function enqueue(envelope: WebhookEnvelope, expiresAtMs: number): StoredWebhookDelivery {
    const createdAtMs = Date.parse(envelope.createdAt);
    const persistenceKey = envelope.event === "wago.test" ? envelope.id : envelope.data.messageId;
    database
      .prepare(`
        INSERT OR IGNORE INTO webhook_deliveries (
          id,
          schema_version,
          event_type,
          message_id,
          payload_json,
          status,
          attempt_count,
          redelivery_count,
          next_attempt_at,
          created_at,
          expires_at
        ) VALUES (?, 1, ?, ?, ?, 'pending', 0, 0, ?, ?, ?)
      `)
      .run(
        envelope.id,
        envelope.event,
        persistenceKey,
        serializeWebhookEnvelope(envelope),
        createdAtMs,
        createdAtMs,
        expiresAtMs,
      );

    const row = selectByMessageEvent.get(persistenceKey, envelope.event) as WebhookDeliveryRow | undefined;
    if (!row) {
      throw new Error("Webhook delivery enqueue failed");
    }

    return mapRow(row);
  }

  function list(options: { status?: WebhookDeliveryStatus; limit?: number } = {}): StoredWebhookDelivery[] {
    const limit = Math.min(100, Math.max(1, options.limit ?? 50));
    const rows = options.status
      ? (database
          .prepare("SELECT * FROM webhook_deliveries WHERE status = ? ORDER BY created_at DESC LIMIT ?")
          .all(options.status, limit) as WebhookDeliveryRow[])
      : (database
          .prepare("SELECT * FROM webhook_deliveries ORDER BY created_at DESC LIMIT ?")
          .all(limit) as WebhookDeliveryRow[]);

    return rows.map(mapRow);
  }

  function claimDue(nowMs: number, limit = 10): StoredWebhookDelivery[] {
    return withTransaction(database, () => {
      database
        .prepare(`
          UPDATE webhook_deliveries
          SET status = 'expired', next_attempt_at = NULL, claimed_at = NULL
          WHERE status IN ('pending', 'delivering') AND expires_at <= ?
        `)
        .run(nowMs);

      const staleClaimBefore = nowMs - WEBHOOK_CLAIM_TIMEOUT_MS;
      const rows = database
        .prepare(`
          SELECT *
          FROM webhook_deliveries
          WHERE expires_at > ?
            AND (
              (status = 'pending' AND next_attempt_at IS NOT NULL AND next_attempt_at <= ?)
              OR
              (status = 'delivering' AND claimed_at IS NOT NULL AND claimed_at <= ?)
            )
          ORDER BY COALESCE(next_attempt_at, claimed_at, created_at) ASC
          LIMIT ?
        `)
        .all(nowMs, nowMs, staleClaimBefore, Math.min(50, Math.max(1, limit))) as WebhookDeliveryRow[];

      for (const row of rows) {
        database
          .prepare("UPDATE webhook_deliveries SET status = 'delivering', claimed_at = ? WHERE id = ?")
          .run(nowMs, row.id);
      }

      return rows.map((row) =>
        mapRow({
          ...row,
          status: "delivering",
          claimed_at: nowMs,
        }),
      );
    });
  }

  function completeAttempt(
    id: string,
    result: WebhookAttemptResult,
    nowMs: number,
    random: () => number = Math.random,
  ): StoredWebhookDelivery | null {
    const current = get(id);
    if (!current) {
      return null;
    }

    const attemptCount = current.attemptCount + 1;
    const firstAttemptAt = current.firstAttemptAt ?? nowMs;

    if (result.ok) {
      database
        .prepare(`
          UPDATE webhook_deliveries
          SET status = 'delivered',
              attempt_count = ?,
              next_attempt_at = NULL,
              first_attempt_at = ?,
              last_attempt_at = ?,
              last_status_code = ?,
              last_error_code = NULL,
              delivered_at = ?,
              claimed_at = NULL
          WHERE id = ?
        `)
        .run(attemptCount, firstAttemptAt, nowMs, result.statusCode, nowMs, id);
      return get(id);
    }

    if (!result.retryable) {
      database
        .prepare(`
          UPDATE webhook_deliveries
          SET status = 'failed',
              attempt_count = ?,
              next_attempt_at = NULL,
              first_attempt_at = ?,
              last_attempt_at = ?,
              last_status_code = ?,
              last_error_code = ?,
              claimed_at = NULL
          WHERE id = ?
        `)
        .run(attemptCount, firstAttemptAt, nowMs, result.statusCode, result.errorCode, id);
      return get(id);
    }

    const retryDelayMs = getWebhookRetryDelayMs(attemptCount, random);
    const nextAttemptAt = nowMs + retryDelayMs;
    if (nowMs >= current.expiresAt || nextAttemptAt >= current.expiresAt) {
      database
        .prepare(`
          UPDATE webhook_deliveries
          SET status = 'expired',
              attempt_count = ?,
              next_attempt_at = NULL,
              first_attempt_at = ?,
              last_attempt_at = ?,
              last_status_code = ?,
              last_error_code = ?,
              claimed_at = NULL
          WHERE id = ?
        `)
        .run(attemptCount, firstAttemptAt, nowMs, result.statusCode, result.errorCode, id);
      return get(id);
    }

    database
      .prepare(`
        UPDATE webhook_deliveries
        SET status = 'pending',
            attempt_count = ?,
            next_attempt_at = ?,
            first_attempt_at = ?,
            last_attempt_at = ?,
            last_status_code = ?,
            last_error_code = ?,
            claimed_at = NULL
        WHERE id = ?
      `)
      .run(attemptCount, nextAttemptAt, firstAttemptAt, nowMs, result.statusCode, result.errorCode, id);
    return get(id);
  }

  function redeliver(id: string, nowMs: number): WebhookRedeliveryResult {
    const current = get(id);
    if (!current) {
      return { kind: "not_found" };
    }

    if (current.status === "delivering") {
      return { kind: "in_progress", delivery: current };
    }

    database
      .prepare(`
        UPDATE webhook_deliveries
        SET status = 'pending',
            attempt_count = 0,
            redelivery_count = redelivery_count + 1,
            next_attempt_at = ?,
            first_attempt_at = NULL,
            last_attempt_at = NULL,
            last_status_code = NULL,
            last_error_code = NULL,
            delivered_at = NULL,
            expires_at = ?,
            claimed_at = NULL
        WHERE id = ?
      `)
      .run(nowMs, nowMs + WEBHOOK_DELIVERY_HORIZON_MS, id);

    const delivery = get(id);
    if (!delivery) {
      return { kind: "not_found" };
    }

    return { kind: "queued", delivery };
  }

  function pruneTerminal(nowMs: number): number {
    const cutoff = nowMs - WEBHOOK_DELIVERY_RETENTION_MS;
    const result = database
      .prepare(`
        DELETE FROM webhook_deliveries
        WHERE status IN ('delivered', 'failed', 'expired')
          AND created_at < ?
      `)
      .run(cutoff);
    return Number(result.changes);
  }

  return {
    enqueue,
    get,
    list,
    claimDue,
    completeAttempt,
    redeliver,
    pruneTerminal,
  };
}
