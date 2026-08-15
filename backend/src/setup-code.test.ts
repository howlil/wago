import { createHash } from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "./app.js";
import { resetBrowserSessionsForTest } from "./auth/browser-session-store.js";
import { config, resetPersistedSettingsForTest } from "./config/index.js";

const setupCode = "generated-first-run-setup-code-with-enough-entropy";
const pairingCandidate = `wa_${"a".repeat(64)}`;
const setupCodeHash = createHash("sha256").update(setupCode).digest("hex");

describe("one-time first-run setup code", () => {
  beforeEach(() => {
    resetPersistedSettingsForTest();
    resetBrowserSessionsForTest();
    config.nodeEnv = "production";
    config.allowWebBootstrap = true;
    config.setupToken = null;
    config.setupCodeHash = setupCodeHash;
    config.setupCodeGeneratedAt = new Date().toISOString();
    config.apiKey = null;
    config.apiKeyHash = null;
    config.apiKeySource = "unset";
    config.requestLogging = false;
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

  it("accepts the generated setup code through X-Wago-Setup-Code and invalidates it", async () => {
    const response = await request(app)
      .post("/app/bootstrap")
      .set("Host", "wago.example.com")
      .set("Origin", "https://wago.example.com")
      .set("X-Wago-Setup-Code", setupCode)
      .send({ apiKey: pairingCandidate });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ success: true, apiKey: pairingCandidate });
    expect(config.setupCodeHash).toBeNull();
    expect(config.setupCodeGeneratedAt).toBeNull();
  });
});
