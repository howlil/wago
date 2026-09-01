import type { DatabaseSync } from "node:sqlite";
import type { WebhookAttemptResult } from "./delivery-webhook-core.js";

export type WebhookAttemptOutcome =
  | "in_progress"
  | "succeeded"
  | "retryable_failure"
  | "permanent_failure"
  | "interrupted";

export type StoredWebhookDeliveryAttempt = {
  sequence: number;
  redeliveryNumber: number;
  outcome: WebhookAttemptOutcome;
  startedAt: number;
  completedAt: number | null;
  statusCode: number | null;
  errorCode: string | null;
  retryable: boolean | null;
  nextAttemptAt: number | null;
};

type AttemptRow = {
  sequence: number;
  redelivery_number: number;
  outcome: WebhookAttemptOutcome;
  started_at: number;
  completed_at: number | null;
  status_code: number | null;
  error_code: string | null;
  retryable: number | null;
  next_attempt_at: number | null;
};

type RecoverableDeliveryRow = {
  id: string;
  expires_at: number;
};

function mapRow(row: AttemptRow): StoredWebhookDeliveryAttempt {
  return {
    sequence: row.sequence,
    redeliveryNumber: row.redelivery_number,
    outcome: row.outcome,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    statusCode: row.status_code,
    errorCode: row.error_code,
    retryable: row.retryable == null ? null : row.retryable === 1,
    nextAttemptAt: row.next_attempt_at,
  };
}

export function createWebhookDeliveryAttemptStore(database: DatabaseSync) {
  const listStatement = database.prepare(`
    SELECT sequence, redelivery_number, outcome, started_at, completed_at, status_code, error_code, retryable, next_attempt_at
    FROM webhook_delivery_attempts
    WHERE delivery_id = ?
    ORDER BY sequence DESC
    LIMIT ?
  `);

  function list(deliveryId: string, limit = 50): StoredWebhookDeliveryAttempt[] {
    const boundedLimit = Math.min(50, Math.max(1, limit));
    return (listStatement.all(deliveryId, boundedLimit) as AttemptRow[]).map(mapRow);
  }

  function start(deliveryId: string, redeliveryNumber: number, nowMs: number): StoredWebhookDeliveryAttempt {
    const row = database
      .prepare("SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence FROM webhook_delivery_attempts WHERE delivery_id = ?")
      .get(deliveryId) as { sequence: number };

    database
      .prepare(`
        INSERT INTO webhook_delivery_attempts (
          delivery_id,
          sequence,
          redelivery_number,
          outcome,
          started_at
        ) VALUES (?, ?, ?, 'in_progress', ?)
      `)
      .run(deliveryId, row.sequence, redeliveryNumber, nowMs);

    return list(deliveryId, 1)[0] as StoredWebhookDeliveryAttempt;
  }

  function complete(
    deliveryId: string,
    result: WebhookAttemptResult,
    nowMs: number,
    nextAttemptAt: number | null,
  ): StoredWebhookDeliveryAttempt | null {
    const outcome: WebhookAttemptOutcome = result.ok
      ? "succeeded"
      : result.retryable
        ? "retryable_failure"
        : "permanent_failure";

    const updated = database
      .prepare(`
        UPDATE webhook_delivery_attempts
        SET outcome = ?,
            completed_at = ?,
            status_code = ?,
            error_code = ?,
            retryable = ?,
            next_attempt_at = ?
        WHERE id = (
          SELECT id
          FROM webhook_delivery_attempts
          WHERE delivery_id = ? AND outcome = 'in_progress'
          ORDER BY sequence DESC
          LIMIT 1
        )
      `)
      .run(
        outcome,
        nowMs,
        result.statusCode,
        result.ok ? null : result.errorCode,
        result.ok ? 0 : result.retryable ? 1 : 0,
        nextAttemptAt,
        deliveryId,
      );

    return Number(updated.changes) === 0 ? null : (list(deliveryId, 1)[0] ?? null);
  }

  function interrupt(deliveryId: string, nowMs: number, nextAttemptAt: number | null = nowMs): boolean {
    const result = database
      .prepare(`
        UPDATE webhook_delivery_attempts
        SET outcome = 'interrupted',
            completed_at = ?,
            error_code = 'WEBHOOK_ATTEMPT_INTERRUPTED',
            retryable = 1,
            next_attempt_at = ?
        WHERE id = (
          SELECT id
          FROM webhook_delivery_attempts
          WHERE delivery_id = ? AND outcome = 'in_progress'
          ORDER BY sequence DESC
          LIMIT 1
        )
      `)
      .run(nowMs, nextAttemptAt, deliveryId);
    return Number(result.changes) > 0;
  }

  function recoverInterrupted(nowMs: number): number {
    const rows = database
      .prepare("SELECT id, expires_at FROM webhook_deliveries WHERE status = 'delivering'")
      .all() as RecoverableDeliveryRow[];

    for (const row of rows) {
      interrupt(row.id, nowMs, row.expires_at <= nowMs ? null : nowMs);
    }

    if (rows.length > 0) {
      database
        .prepare(`
          UPDATE webhook_deliveries
          SET status = CASE WHEN expires_at <= ? THEN 'expired' ELSE 'pending' END,
              next_attempt_at = CASE WHEN expires_at <= ? THEN NULL ELSE ? END,
              claimed_at = NULL
          WHERE status = 'delivering'
        `)
        .run(nowMs, nowMs, nowMs);
    }

    return rows.length;
  }

  return {
    list,
    start,
    complete,
    interrupt,
    recoverInterrupted,
  };
}
