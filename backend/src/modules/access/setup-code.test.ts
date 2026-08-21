import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../app.js";
import { config } from "../../config/index.js";
import { resetAccessStateForTest } from "./api-key.js";
import { resetBrowserSessionsForTest } from "./browser-session-store.js";

const setupCode = "generated-first-run-setup-code-with-enough-entropy";
const pairingCandidate = `wa_${"a".repeat(64)}`;

describe("one-time first-run setup code", () => {
  beforeEach(() => {
    resetAccessStateForTest();
    resetBrowserSessionsForTest();
    config.nodeEnv = "production";
    config.setupToken = setupCode;
    config.requestLogging = false;
  });

  afterEach(() => {
    config.nodeEnv = "test";
    config.setupToken = null;
  });

  it("advertises setup-code authorization instead of deployment-token configuration", async () => {
    const response = await request(app).get("/app/info");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      credentialSetupRequired: true,
      setupCodeRequired: true,
      webBootstrapEnabled: true,
    });
  });

  it("accepts setup authorization through X-Wago-Setup-Code", async () => {
    const response = await request(app)
      .post("/app/bootstrap")
      .set("Host", "wago.example.com")
      .set("Origin", "https://wago.example.com")
      .set("X-Wago-Setup-Code", setupCode)
      .send({ apiKey: pairingCandidate });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ success: true, apiKey: pairingCandidate });
  });
});
