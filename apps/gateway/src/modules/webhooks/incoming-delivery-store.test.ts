import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { migrations, runMigrations } from "../../infrastructure/database/migrations.js";
import { createWebhookDeliveryStore, WEBHOOK_DELIVERY_HORIZON_MS } from "./delivery-store.js";
import { createIncomingMessageWebhookEnvelope } from "./delivery-webhook-core.js";

describe("incoming webhook delivery persistence", () => {
  function setup() {
    const database = new DatabaseSync(":memory:");
    database.exec("PRAGMA foreign_keys = ON");
    runMigrations(database, migrations);
    return { database, store: createWebhookDeliveryStore(database) };
  }

  it("deduplicates the same logical incoming message by message id and event", () => {
    const { database, store } = setup();
    const now = new Date("2026-09-02T00:00:00.000Z");
    const input = {
      messageId: "in_same",
      from: "6281234567890",
      text: "hello",
      receivedAt: now.toISOString(),
    };

    const first = createIncomingMessageWebhookEnvelope(input, {
      createDeliveryId: () => "11111111-1111-4111-8111-111111111111",
      now: () => now,
    });
    const duplicate = createIncomingMessageWebhookEnvelope(input, {
      createDeliveryId: () => "22222222-2222-4222-8222-222222222222",
      now: () => new Date(now.getTime() + 1000),
    });

    const storedFirst = store.enqueue(first, now.getTime() + WEBHOOK_DELIVERY_HORIZON_MS);
    const storedDuplicate = store.enqueue(duplicate, now.getTime() + WEBHOOK_DELIVERY_HORIZON_MS);

    expect(storedDuplicate.id).toBe(storedFirst.id);
    expect(store.list({ limit: 10 })).toHaveLength(1);
    database.close();
  });

  it("retains inbound content only while retry delivery is active", () => {
    const { database, store } = setup();
    const now = new Date("2026-09-02T00:00:00.000Z");
    const envelope = createIncomingMessageWebhookEnvelope(
      {
        messageId: "in_private",
        from: "6281234567890",
        text: "sensitive text",
        receivedAt: now.toISOString(),
      },
      {
        createDeliveryId: () => "33333333-3333-4333-8333-333333333333",
        now: () => now,
      },
    );

    store.enqueue(envelope, now.getTime() + WEBHOOK_DELIVERY_HORIZON_MS);
    const active = store.get(envelope.id);
    expect(active?.payloadJson).toContain("sensitive text");
    expect(active?.payloadJson).toContain("6281234567890");

    store.claimDue(now.getTime(), 1);
    store.completeAttempt(envelope.id, { ok: true, statusCode: 204 }, now.getTime() + 1000);

    const terminal = store.get(envelope.id);
    expect(terminal?.status).toBe("delivered");
    expect(terminal?.payloadJson).toBe("{}");
    database.close();
  });

  it("expires and redacts an inbound payload even when no sender attempts it", () => {
    const { database, store } = setup();
    const now = new Date("2026-09-02T00:00:00.000Z");
    const envelope = createIncomingMessageWebhookEnvelope(
      {
        messageId: "in_expiring",
        from: "6281234567890",
        text: "expires without sender",
        receivedAt: now.toISOString(),
      },
      {
        createDeliveryId: () => "44444444-4444-4444-8444-444444444444",
        now: () => now,
      },
    );

    const expiresAt = now.getTime() + 1000;
    store.enqueue(envelope, expiresAt);

    expect(store.expireDue(expiresAt + 1)).toBe(1);
    const expired = store.get(envelope.id);
    expect(expired?.status).toBe("expired");
    expect(expired?.payloadJson).toBe("{}");
    database.close();
  });
});
