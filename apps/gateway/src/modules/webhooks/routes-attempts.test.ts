import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../app.js";
import { config } from "../../config/index.js";
import { getDatabase } from "../../infrastructure/database.js";
import { resetAccessStateForTest } from "../access/api-key.js";
import { createBrowserSession, resetBrowserSessionsForTest } from "../access/browser-session-store.js";
import { createWebhookDeliveryStore } from "./delivery-store.js";
import { createIncomingMessageWebhookEnvelope } from "./delivery-webhook-core.js";
import { webhookSettingsStore as settingsStore } from "./settings-runtime.js";

describe("webhook attempt diagnostics routes", () => {
  beforeEach(() => {
    resetAccessStateForTest({ apiKey: "webhook-attempt-key", apiKeySource: "env" });
    resetBrowserSessionsForTest();
    settingsStore.clear();
  });

  afterEach(() => {
    resetAccessStateForTest();
    resetBrowserSessionsForTest();
    settingsStore.clear();
  });

  it("returns bounded sanitized attempt history for a delivery detail", async () => {
    settingsStore.save({ enabled: true, url: "https://receiver.example.test/webhook" });
    const session = createBrowserSession();
    const queued = await request(app).post("/webhooks/test").set("Cookie", `${config.authCookieName}=${session.token}`);

    expect(queued.status).toBe(202);
    const deliveryId = queued.body.delivery.id as string;

    const detail = await request(app)
      .get(`/webhooks/deliveries/${deliveryId}`)
      .set("Authorization", "Bearer webhook-attempt-key");

    expect(detail.status).toBe(200);
    expect(detail.body.delivery).toMatchObject({ id: deliveryId, attempts: expect.any(Array) });
    expect(detail.body.delivery.attempts.length).toBeGreaterThan(0);
    expect(detail.body.delivery.attempts[0]).toMatchObject({
      sequence: expect.any(Number),
      redeliveryNumber: expect.any(Number),
      outcome: expect.stringMatching(/^(in_progress|succeeded|retryable_failure|permanent_failure|interrupted)$/),
      startedAt: expect.any(String),
    });
    expect(detail.body.delivery.payloadJson).toBeUndefined();
    expect(detail.body.delivery.url).toBeUndefined();
    expect(detail.body.delivery.secret).toBeUndefined();
  });

  it("rejects manual redelivery once an incoming message payload is terminal and redacted", async () => {
    settingsStore.save({ enabled: true, url: "https://receiver.example.test/webhook" });
    const database = getDatabase();
    const store = createWebhookDeliveryStore(database);
    const now = new Date("2026-09-02T00:00:00.000Z");
    const envelope = createIncomingMessageWebhookEnvelope(
      {
        messageId: "in_route_redacted",
        from: "6281234567890",
        text: "private route payload",
        receivedAt: now.toISOString(),
      },
      {
        createDeliveryId: () => "55555555-5555-4555-8555-555555555555",
        now: () => now,
      },
    );
    store.enqueue(envelope, now.getTime() + 60_000);
    database.prepare("UPDATE webhook_deliveries SET status = 'delivered' WHERE id = ?").run(envelope.id);

    const response = await request(app)
      .post(`/webhooks/deliveries/${envelope.id}/redeliver`)
      .set("Authorization", "Bearer webhook-attempt-key");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      error: "WEBHOOK_PAYLOAD_REDACTED",
      message: "Incoming message payload was redacted after terminal delivery and cannot be manually redelivered",
    });
    expect(store.get(envelope.id)?.payloadJson).toBe("{}");
  });
});
