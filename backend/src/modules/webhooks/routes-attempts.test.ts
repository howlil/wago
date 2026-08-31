import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../app.js";
import { config } from "../../config/index.js";
import { resetAccessStateForTest } from "../access/api-key.js";
import { createBrowserSession, resetBrowserSessionsForTest } from "../access/browser-session-store.js";
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
    const queued = await request(app)
      .post("/webhooks/test")
      .set("Cookie", `${config.authCookieName}=${session.token}`);

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
});
