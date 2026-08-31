import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { resetAccessStateForTest } from "../access/api-key.js";
import { metricsRouter } from "./routes.js";

function makeApp() {
  const app = express();
  app.use("/metrics", metricsRouter);
  return app;
}

describe("operational metrics route", () => {
  beforeEach(() => {
    resetAccessStateForTest();
  });

  it("requires an authenticated request", async () => {
    const response = await request(makeApp()).get("/metrics");

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("returns Prometheus text for an authenticated machine client", async () => {
    resetAccessStateForTest({ apiKey: "metrics-key", apiKeySource: "env" });

    const response = await request(makeApp()).get("/metrics").set("Authorization", "Bearer metrics-key");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.text).toContain("# TYPE wago_gateway_readiness gauge");
    expect(response.text).toContain("wago_outbound_pending_dispatch");
    expect(response.text).not.toContain("messageId");
    expect(response.text).not.toContain("recipient");
  });
});
