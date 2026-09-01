import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../../infrastructure/database/migrations.js";
import {
  createWebhookDeliveryStore,
  WEBHOOK_CLAIM_TIMEOUT_MS,
  WEBHOOK_DELIVERY_HORIZON_MS,
  WEBHOOK_DELIVERY_RETENTION_MS,
} from "./delivery-store.js";
import { createMessageDeliveryWebhookEnvelope } from "./delivery-webhook-core.js";

const NOW = Date.parse("2026-08-12T14:00:00.000Z");

function envelope(id: string, messageId = "message-1") {
  return createMessageDeliveryWebhookEnvelope(
    { messageId, status: "accepted" },
    {
      createDeliveryId: () => id,
      now: () => new Date(NOW),
    },
  );
}

describe("webhook delivery store", () => {
  let database: DatabaseSync;

  beforeEach(() => {
    database = new DatabaseSync(":memory:");
    database.exec("PRAGMA foreign_keys = ON");
    runMigrations(database);
  });

  afterEach(() => {
    database.close();
  });

  it("persists a queued delivery and deduplicates the same message event", () => {
    const store = createWebhookDeliveryStore(database);
    const first = store.enqueue(envelope("delivery-1"), NOW + WEBHOOK_DELIVERY_HORIZON_MS);
    const second = store.enqueue(envelope("delivery-2"), NOW + WEBHOOK_DELIVERY_HORIZON_MS);

    expect(first.id).toBe("delivery-1");
    expect(second.id).toBe("delivery-1");
    expect(createWebhookDeliveryStore(database).get("delivery-1")).toMatchObject({
      status: "pending",
      event: "message.server_accepted",
      messageId: "message-1",
      attemptCount: 0,
      redeliveryCount: 0,
    });
    expect(store.listAttempts("delivery-1")).toEqual([]);
  });

  it("persists retry scheduling and append-only attempt evidence after a retryable failure", () => {
    const store = createWebhookDeliveryStore(database);
    store.enqueue(envelope("delivery-1"), NOW + WEBHOOK_DELIVERY_HORIZON_MS);

    expect(store.claimDue(NOW)).toHaveLength(1);
    expect(store.listAttempts("delivery-1")).toEqual([
      expect.objectContaining({ sequence: 1, redeliveryNumber: 0, outcome: "in_progress", startedAt: NOW }),
    ]);

    const updated = store.completeAttempt(
      "delivery-1",
      {
        ok: false,
        retryable: true,
        statusCode: 503,
        errorCode: "WEBHOOK_HTTP_SERVER_ERROR",
      },
      NOW + 100,
      () => 0.5,
    );

    expect(updated).toMatchObject({
      status: "pending",
      attemptCount: 1,
      lastStatusCode: 503,
      lastErrorCode: "WEBHOOK_HTTP_SERVER_ERROR",
      nextAttemptAt: NOW + 5_100,
    });
    expect(store.listAttempts("delivery-1")).toEqual([
      expect.objectContaining({
        sequence: 1,
        outcome: "retryable_failure",
        completedAt: NOW + 100,
        statusCode: 503,
        errorCode: "WEBHOOK_HTTP_SERVER_ERROR",
        retryable: true,
        nextAttemptAt: NOW + 5_100,
      }),
    ]);
  });

  it("marks an interrupted in-flight attempt on restart and retries with a new sequence", () => {
    const store = createWebhookDeliveryStore(database);
    store.enqueue(envelope("delivery-1"), NOW + WEBHOOK_DELIVERY_HORIZON_MS);
    expect(store.claimDue(NOW)).toHaveLength(1);

    const restartedStore = createWebhookDeliveryStore(database);
    expect(restartedStore.recoverInterrupted(NOW + 100)).toBe(1);
    expect(restartedStore.get("delivery-1")).toMatchObject({
      status: "pending",
      nextAttemptAt: NOW + 100,
      claimedAt: null,
    });
    expect(restartedStore.listAttempts("delivery-1")).toEqual([
      expect.objectContaining({
        sequence: 1,
        outcome: "interrupted",
        completedAt: NOW + 100,
        errorCode: "WEBHOOK_ATTEMPT_INTERRUPTED",
        retryable: true,
      }),
    ]);

    expect(restartedStore.claimDue(NOW + 100)).toHaveLength(1);
    expect(restartedStore.listAttempts("delivery-1")).toEqual([
      expect.objectContaining({ sequence: 2, outcome: "in_progress" }),
      expect.objectContaining({ sequence: 1, outcome: "interrupted" }),
    ]);
  });

  it("keeps stale-claim recovery as a fallback and records the interruption", () => {
    const store = createWebhookDeliveryStore(database);
    store.enqueue(envelope("delivery-1"), NOW + WEBHOOK_DELIVERY_HORIZON_MS);
    expect(store.claimDue(NOW)).toHaveLength(1);

    const restartedStore = createWebhookDeliveryStore(database);
    expect(restartedStore.claimDue(NOW + WEBHOOK_CLAIM_TIMEOUT_MS - 1)).toHaveLength(0);
    expect(restartedStore.claimDue(NOW + WEBHOOK_CLAIM_TIMEOUT_MS + 1)).toHaveLength(1);
    expect(restartedStore.listAttempts("delivery-1")).toEqual([
      expect.objectContaining({ sequence: 2, outcome: "in_progress" }),
      expect.objectContaining({ sequence: 1, outcome: "interrupted" }),
    ]);
  });

  it("preserves signed payload identity and prior attempt evidence across manual redelivery", () => {
    const store = createWebhookDeliveryStore(database);
    const queued = store.enqueue(envelope("delivery-1"), NOW + WEBHOOK_DELIVERY_HORIZON_MS);
    const originalPayload = queued.payloadJson;

    const firstAttempt = store.claimDue(NOW)[0];
    expect(firstAttempt).toMatchObject({ id: "delivery-1", payloadJson: originalPayload });

    const retry = store.completeAttempt(
      "delivery-1",
      {
        ok: false,
        retryable: true,
        statusCode: 503,
        errorCode: "WEBHOOK_HTTP_SERVER_ERROR",
      },
      NOW + 100,
      () => 0.5,
    );
    expect(retry).toMatchObject({ id: "delivery-1", payloadJson: originalPayload, status: "pending" });

    store.claimDue(NOW + 5_100);
    store.completeAttempt(
      "delivery-1",
      {
        ok: false,
        retryable: false,
        statusCode: 401,
        errorCode: "WEBHOOK_HTTP_CLIENT_ERROR",
      },
      NOW + 5_200,
    );

    const beforeRedelivery = store.listAttempts("delivery-1");
    expect(beforeRedelivery).toHaveLength(2);
    expect(beforeRedelivery[0]).toMatchObject({ sequence: 2, outcome: "permanent_failure", redeliveryNumber: 0 });

    const redelivery = store.redeliver("delivery-1", NOW + 10_000);
    expect(redelivery.kind).toBe("queued");
    if (redelivery.kind !== "queued") throw new Error("Expected queued redelivery");
    expect(redelivery.delivery).toMatchObject({
      id: "delivery-1",
      payloadJson: originalPayload,
      status: "pending",
      attemptCount: 0,
      redeliveryCount: 1,
    });
    expect(store.listAttempts("delivery-1")).toEqual(beforeRedelivery);

    store.claimDue(NOW + 10_000);
    expect(store.listAttempts("delivery-1")[0]).toMatchObject({
      sequence: 3,
      outcome: "in_progress",
      redeliveryNumber: 1,
    });
  });

  it("marks permanent failures and supports manual redelivery with a fresh horizon", () => {
    const store = createWebhookDeliveryStore(database);
    store.enqueue(envelope("delivery-1"), NOW + WEBHOOK_DELIVERY_HORIZON_MS);
    store.claimDue(NOW);
    store.completeAttempt(
      "delivery-1",
      {
        ok: false,
        retryable: false,
        statusCode: 401,
        errorCode: "WEBHOOK_HTTP_CLIENT_ERROR",
      },
      NOW + 100,
    );

    expect(store.get("delivery-1")?.status).toBe("failed");

    const redelivery = store.redeliver("delivery-1", NOW + 10_000);
    expect(redelivery.kind).toBe("queued");
    if (redelivery.kind !== "queued") throw new Error("Expected queued redelivery");
    expect(redelivery.delivery).toMatchObject({
      id: "delivery-1",
      status: "pending",
      attemptCount: 0,
      redeliveryCount: 1,
      nextAttemptAt: NOW + 10_000,
      expiresAt: NOW + 10_000 + WEBHOOK_DELIVERY_HORIZON_MS,
    });
  });

  it("prunes old terminal delivery history and cascades its attempt evidence", () => {
    const store = createWebhookDeliveryStore(database);
    store.enqueue(envelope("delivery-old", "message-old"), NOW + WEBHOOK_DELIVERY_HORIZON_MS);
    store.claimDue(NOW);
    store.completeAttempt("delivery-old", { ok: true, statusCode: 204 }, NOW + 100);
    store.enqueue(envelope("delivery-active", "message-active"), NOW + WEBHOOK_DELIVERY_HORIZON_MS);

    const deleted = store.pruneTerminal(NOW + WEBHOOK_DELIVERY_RETENTION_MS + 1);

    expect(deleted).toBe(1);
    expect(store.get("delivery-old")).toBeNull();
    expect(store.listAttempts("delivery-old")).toEqual([]);
    expect(store.get("delivery-active")).not.toBeNull();
  });
});
