import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "../app.js";
import { config } from "../config/index.js";

const UNKNOWN_DELIVERY_ID = "11111111-1111-4111-8111-111111111111";

describe("webhook delivery routes", () => {
  beforeEach(() => {
    config.apiKey = "webhook-test-key";
    config.apiKeyHash = null;
    config.apiKeySource = "env";
  });

  afterEach(() => {
    config.apiKey = null;
  });

  it("requires API authentication", async () => {
    const response = await request(app).get("/webhooks/deliveries");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: "UNAUTHORIZED",
    });
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
});
