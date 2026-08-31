import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../../infrastructure/database/migrations.js";
import { createWebhookDeliveryStore } from "./delivery-store.js";
import { createMessageDeliveryWebhookEnvelope } from "./delivery-webhook-core.js";

const NOW = Date.parse("2026-08-31T07:00:00.000Z");

describe("webhook delivery expiry attempt evidence", () => {
  let database: DatabaseSync;

  beforeEach(() => {
    database = new DatabaseSync(":memory:");
    database.exec("PRAGMA foreign_keys = ON");
    runMigrations(database);
  });

  afterEach(() => database.close());

  it("closes an in-progress attempt when its delivery horizon expires", () => {
    const store = createWebhookDeliveryStore(database);
    const envelope = createMessageDeliveryWebhookEnvelope(
      { messageId: "message-expiry", status: "accepted" },
      { createDeliveryId: () => "delivery-expiry", now: () => new Date(NOW) },
    );

    store.enqueue(envelope, NOW + 100);
    expect(store.claimDue(NOW)).toHaveLength(1);
    expect(store.listAttempts("delivery-expiry")[0]).toMatchObject({ outcome: "in_progress" });

    expect(store.claimDue(NOW + 100)).toEqual([]);
    expect(store.get("delivery-expiry")).toMatchObject({ status: "expired", claimedAt: null, nextAttemptAt: null });
    expect(store.listAttempts("delivery-expiry")[0]).toMatchObject({
      outcome: "interrupted",
      completedAt: NOW + 100,
      errorCode: "WEBHOOK_ATTEMPT_INTERRUPTED",
      retryable: true,
      nextAttemptAt: null,
    });
  });
});
