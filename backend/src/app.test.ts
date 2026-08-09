import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "./app.js";
import { config, hashApiKey } from "./config/index.js";
import { resetRecipientStoreForTest } from "./recipients/store.js";

const apiKeyRequiredResponse = {
  success: false,
  error: "API_KEY_REQUIRED",
  message: "Initialize the app from the web UI or set API_KEY on the backend before using this operation",
};

describe("app", () => {
  beforeEach(async () => {
    config.allowWebBootstrap = true;
    config.apiKey = null;
    config.apiKeyHash = null;
    config.apiKeySource = "unset";
    config.requestLogging = false;
    config.corsOrigin = "*";
    await resetRecipientStoreForTest();
  });

  it("returns health status", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("does not trust proxy headers", () => {
    expect(app.get("trust proxy")).toBe(false);
  });

  it("returns a request id header when request logging is enabled", async () => {
    config.requestLogging = true;
    const response = await request(app).get("/health").set("X-Request-Id", "test-request-id");
    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toBe("test-request-id");
  });

  it("sets baseline security headers", async () => {
    const response = await request(app).get("/health");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });

  it("returns readiness status", async () => {
    config.apiKey = "ready-key";
    config.apiKeySource = "env";
    const response = await request(app).get("/ready");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", appId: config.appId, apiKeyConfigured: true });
  });

  it("treats generated API key hashes as ready in development", async () => {
    config.apiKeyHash = hashApiKey("ready-key");
    config.apiKeySource = "generated";
    const response = await request(app).get("/ready");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "ok", apiKeyConfigured: true });
  });

  it("allows browser clients to consume the API during local development", async () => {
    const response = await request(app).get("/app/info").set("Origin", "http://127.0.0.1:5173");
    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
  });

  it("returns a JSON API error for malformed JSON bodies", async () => {
    const response = await request(app)
      .post("/messages/send")
      .set("Content-Type", "application/json")
      .send("{bad json");
    expect(response.status).toBe(400);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toEqual({
      success: false,
      error: "INVALID_JSON",
      message: "Request body must be valid JSON",
    });
  });

  it("returns a JSON API error for oversized JSON bodies", async () => {
    const response = await request(app)
      .post("/messages/send")
      .set("Content-Type", "application/json")
      .send({
        to: "081234567890",
        text: "x".repeat(40_000),
      });
    expect(response.status).toBe(413);
    expect(response.body).toEqual({ success: false, error: "PAYLOAD_TOO_LARGE", message: "Request body is too large" });
  });

  it("protects send-message when API_KEY is not configured", async () => {
    const response = await request(app).post("/messages/send").send({ to: "081234567890", text: "Connectivity check" });
    expect(response.status).toBe(403);
    expect(response.body).toEqual(apiKeyRequiredResponse);
  });

  it("protects destructive WhatsApp rebind when API_KEY is not configured", async () => {
    const response = await request(app).post("/whatsapp/rebind");
    expect(response.status).toBe(403);
    expect(response.body).toEqual(apiKeyRequiredResponse);
  });

  it("returns a protected response for unknown message status without auth", async () => {
    const response = await request(app).get("/messages/unknown-message-id/status");
    expect(response.status).toBe(403);
    expect(response.body).toEqual(apiKeyRequiredResponse);
  });

  it("allows, lists, and opts out recipients through protected routes", async () => {
    config.apiKey = "test-key";
    config.apiKeySource = "env";

    const allowResponse = await request(app).post("/recipients/allow").set("Authorization", "Bearer test-key").send({
      phone: "081234567890",
      label: "Customer A",
    });
    expect(allowResponse.status).toBe(201);
    expect(allowResponse.body.recipient).toMatchObject({
      jid: "6281234567890@s.whatsapp.net",
      label: "Customer A",
      allowed: true,
      optedOut: false,
    });

    const listResponse = await request(app).get("/recipients").set("Authorization", "Bearer test-key");
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.recipients).toHaveLength(1);

    const optOutResponse = await request(app)
      .post("/recipients/6281234567890/opt-out")
      .set("Authorization", "Bearer test-key");
    expect(optOutResponse.status).toBe(200);
    expect(optOutResponse.body.recipient).toMatchObject({
      jid: "6281234567890@s.whatsapp.net",
      allowed: true,
      optedOut: true,
    });
  });

  it("bootstraps a generated API key in development", async () => {
    const response = await request(app).post("/app/bootstrap");
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.appId).toBe(config.appId);
    expect(response.body.apiKey).toMatch(/^wa_/);
    expect(response.headers["set-cookie"]?.[0]).toContain(config.authCookieName);
    expect(config.apiKey).toBeNull();
    expect(config.apiKeyHash).toBe(hashApiKey(response.body.apiKey));
    expect(config.apiKeySource).toBe("generated");
  });

  it("authenticates generated API keys by persisted hash", async () => {
    config.apiKeyHash = hashApiKey("generated-key");
    config.apiKeySource = "generated";
    const response = await request(app).get("/recipients").set("Authorization", "Bearer generated-key");
    expect(response.status).toBe(200);
  });

  it("rejects cookie-authenticated state changes from a different configured origin", async () => {
    config.apiKeyHash = hashApiKey("generated-key");
    config.apiKeySource = "generated";
    config.corsOrigin = "https://app.example.com";

    const response = await request(app)
      .post("/recipients/allow")
      .set("Origin", "https://evil.example.com")
      .set("Cookie", `${config.authCookieName}=generated-key`)
      .send({ phone: "6281234567890" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      error: "INVALID_ORIGIN",
      message: "Cookie-authenticated requests must come from the configured origin",
    });
  });

  it("rejects web bootstrap when disabled", async () => {
    config.allowWebBootstrap = false;
    const response = await request(app).post("/app/bootstrap");
    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      error: "WEB_BOOTSTRAP_DISABLED",
      message: "Web bootstrap is disabled in production. Configure API_KEY before starting Wago.",
    });
  });

  it("rejects bootstrap after an API key exists", async () => {
    config.apiKey = "existing-key";
    config.apiKeySource = "env";
    const response = await request(app).post("/app/bootstrap");
    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      error: "APP_ALREADY_INITIALIZED",
      message: "This app is already initialized. Use the existing API key or auth cookie.",
    });
  });
});
