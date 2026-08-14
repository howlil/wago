import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "../app.js";
import { resetAccessStateForTest } from "../modules/access/api-key.js";
import { webhookSettingsStore as settingsStore } from "../webhooks/settings-runtime.js";

const UNKNOWN_DELIVERY_ID = "11111111-1111-4111-8111-111111111111";

describe("webhook delivery routes", () => {
  beforeEach(() => {
    resetAccessStateForTest({ apiKey: "webhook-test-key", apiKeySource: "env" });
    settingsStore.clear();
  });

  afterEach(() => {
    resetAccessStateForTest();
    settingsStore.clear();
  });

  it("requires API authentication", async () => {
    const response = await request(app).get("/webhooks/deliveries");
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, error: "UNAUTHORIZED" });
  });

  it("rejects invalid delivery status filters", async () => {
    const response = await request(app)
      .get("/webhooks/deliveries")
      .query({ status: "unknown" })
      .set("Authorization", "Bearer webhook-test-key");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: "INVALID_WEBHOOK_DELIVERY_STATUS",
      message: "Webhook delivery status filter is invalid",
    });
  });

  it("validates delivery IDs before querying durable state", async () => {
    const response = await request(app)
      .get("/webhooks/deliveries/not-a-delivery-id")
      .set("Authorization", "Bearer webhook-test-key");
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("INVALID_WEBHOOK_DELIVERY_ID");
  });

  it("returns 404 for unknown valid delivery ids", async () => {
    const response = await request(app)
      .get(`/webhooks/deliveries/${UNKNOWN_DELIVERY_ID}`)
      .set("Authorization", "Bearer webhook-test-key");
    expect(response.status).toBe(404);
    expect(response.body.error).toBe("WEBHOOK_DELIVERY_NOT_FOUND");
  });

  it("returns webhook settings without exposing signing secrets", async () => {
    settingsStore.importLegacyIfEmpty({
      enabled: true,
      url: "https://receiver.example.test/webhook",
      secret: "a".repeat(32),
      previousSecret: "b".repeat(32),
    });

    const response = await request(app).get("/webhooks/settings").set("Authorization", "Bearer webhook-test-key");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      enabled: true,
      url: "https://receiver.example.test/webhook",
      secretConfigured: true,
      rotationPending: true,
    });
    expect(response.body.secret).toBeUndefined();
    expect(response.body.previousSecret).toBeUndefined();
  });

  it("creates the signing secret once when webhook delivery is enabled", async () => {
    const first = await request(app)
      .put("/webhooks/settings")
      .set("Authorization", "Bearer webhook-test-key")
      .send({ enabled: true, url: "https://receiver.example.test/webhook" });

    expect(first.status).toBe(200);
    expect(first.body.enabled).toBe(true);
    expect(first.body.secretConfigured).toBe(true);
    expect(first.body.generatedSecret).toEqual(expect.any(String));

    const originalSecret = first.body.generatedSecret;
    const second = await request(app)
      .put("/webhooks/settings")
      .set("Authorization", "Bearer webhook-test-key")
      .send({ enabled: true, url: "https://receiver.example.test/v2/webhook" });

    expect(second.status).toBe(200);
    expect(second.body.url).toBe("https://receiver.example.test/v2/webhook");
    expect(second.body.generatedSecret).toBeUndefined();
    expect(settingsStore.get()?.secret).toBe(originalSecret);
  });

  it("rotates and completes webhook signing-secret overlap", async () => {
    const configured = settingsStore.save({ enabled: true, url: "https://receiver.example.test/webhook" });

    const rotated = await request(app)
      .post("/webhooks/settings/rotate-secret")
      .set("Authorization", "Bearer webhook-test-key");

    expect(rotated.status).toBe(200);
    expect(rotated.body.generatedSecret).toEqual(expect.any(String));
    expect(rotated.body.generatedSecret).not.toBe(configured.generatedSecret);
    expect(rotated.body.rotationPending).toBe(true);

    const completed = await request(app)
      .post("/webhooks/settings/complete-rotation")
      .set("Authorization", "Bearer webhook-test-key");

    expect(completed.status).toBe(200);
    expect(completed.body.rotationPending).toBe(false);
  });
});
