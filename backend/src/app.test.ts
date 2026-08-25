import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "./app.js";
import { config } from "./config/index.js";
import { getAccessSnapshot, hashApiKey, isApiKeyValid, resetAccessStateForTest } from "./modules/access/api-key.js";
import { resetBrowserSessionsForTest } from "./modules/access/browser-session-store.js";
import { resetRecipientStoreForTest } from "./modules/recipients/store.js";

const apiKeyRequiredResponse = {
  success: false,
  error: "API_KEY_REQUIRED",
  message: "Start the first WhatsApp pairing from the Wago dashboard to initialize gateway credentials",
};

const pairingCandidate = `wa_${"a".repeat(64)}`;
const productionAdminPassword = "correct-horse-battery-staple";

function firstCookie(response: request.Response): string {
  const header = response.headers["set-cookie"]?.[0];
  if (!header) throw new Error("expected Set-Cookie header");
  return header.split(";", 1)[0];
}

describe("app", () => {
  beforeEach(async () => {
    resetAccessStateForTest();
    config.adminPassword = null;
    config.nodeEnv = "test";
    config.requestLogging = false;
    resetBrowserSessionsForTest();
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

  it("returns readiness status before first-run setup", async () => {
    const response = await request(app).get("/ready");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "ok",
      appId: getAccessSnapshot().appId,
      apiKeyConfigured: false,
      checks: { apiKey: { status: "ok", reason: "setup_required" } },
    });
  });

  it("treats generated API key hashes as ready", async () => {
    resetAccessStateForTest({ apiKeyHash: hashApiKey("ready-key"), apiKeySource: "generated" });
    const response = await request(app).get("/ready");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "ok", apiKeyConfigured: true });
  });

  it("does not advertise wildcard browser CORS access", async () => {
    const response = await request(app).get("/app/info").set("Origin", "https://other.example.com");
    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
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
      .send({ to: "081234567890", text: "x".repeat(40_000) });
    expect(response.status).toBe(413);
    expect(response.body).toEqual({ success: false, error: "PAYLOAD_TOO_LARGE", message: "Request body is too large" });
  });

  it("protects send-message before first-run setup", async () => {
    const response = await request(app).post("/messages/send").send({ to: "081234567890", text: "Connectivity check" });
    expect(response.status).toBe(403);
    expect(response.body).toEqual(apiKeyRequiredResponse);
  });

  it("protects destructive WhatsApp rebind before first-run setup", async () => {
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
    resetAccessStateForTest({ apiKey: "test-key", apiKeySource: "env" });
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

  it("bootstraps the pairing-generated API key and a separate browser session in development", async () => {
    const response = await request(app).post("/app/bootstrap").send({ apiKey: pairingCandidate });
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.appId).toBe(getAccessSnapshot().appId);
    expect(response.body.apiKey).toBe(pairingCandidate);
    expect(response.headers["set-cookie"]?.[0]).toContain(config.authCookieName);
    expect(response.headers["set-cookie"]?.[0]).not.toContain(pairingCandidate);
    expect(getAccessSnapshot().apiKeySource).toBe("generated");
    expect(getAccessSnapshot().apiKeyConfigured).toBe(true);
    expect(isApiKeyValid(pairingCandidate)).toBe(true);
  });

  it("uses the admin password to establish a production dashboard session before API bootstrap", async () => {
    config.nodeEnv = "production";
    config.adminPassword = productionAdminPassword;

    const info = await request(app).get("/app/info");
    expect(info.body).toMatchObject({ adminPasswordConfigured: true, apiKeyConfigured: false });

    const rejected = await request(app)
      .post("/app/session")
      .set("Host", "wago.example.com")
      .set("Origin", "https://wago.example.com")
      .send({ password: "wrong-password" });
    expect(rejected.status).toBe(401);
    expect(rejected.body.error).toBe("UNAUTHORIZED");

    const login = await request(app)
      .post("/app/session")
      .set("Host", "wago.example.com")
      .set("Origin", "https://wago.example.com")
      .send({ password: productionAdminPassword });
    expect(login.status).toBe(200);
    const cookie = firstCookie(login);

    const bootstrap = await request(app)
      .post("/app/bootstrap")
      .set("Host", "wago.example.com")
      .set("Origin", "https://wago.example.com")
      .set("Cookie", cookie)
      .send({ apiKey: pairingCandidate });
    expect(bootstrap.status).toBe(201);
    expect(bootstrap.body.apiKey).toBe(pairingCandidate);
    expect(bootstrap.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects first-run production bootstrap from a different origin", async () => {
    config.nodeEnv = "production";
    config.adminPassword = productionAdminPassword;
    const response = await request(app)
      .post("/app/bootstrap")
      .set("Host", "wago.example.com")
      .set("Origin", "https://evil.example.com")
      .send({ apiKey: pairingCandidate });
    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      error: "INVALID_SETUP_ORIGIN",
      message: "First-run setup must come from the Wago dashboard origin.",
    });
  });

  it("authenticates generated API keys by persisted hash", async () => {
    resetAccessStateForTest({ apiKeyHash: hashApiKey("generated-key"), apiKeySource: "generated" });
    const response = await request(app).get("/recipients").set("Authorization", "Bearer generated-key");
    expect(response.status).toBe(200);
  });

  it("does not allow machine API keys to create dashboard sessions", async () => {
    resetAccessStateForTest({ apiKeyHash: hashApiKey("generated-key"), apiKeySource: "generated" });
    const response = await request(app).post("/app/session").send({ apiKey: "generated-key" });
    expect(response.status).toBe(503);
    expect(response.body.error).toBe("ADMIN_PASSWORD_REQUIRED");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects cookie-authenticated state changes from a different request origin", async () => {
    config.adminPassword = productionAdminPassword;
    const login = await request(app).post("/app/session").send({ password: productionAdminPassword });
    const cookie = firstCookie(login);
    const response = await request(app)
      .post("/recipients/allow")
      .set("Host", "wago.example.com")
      .set("Origin", "https://evil.example.com")
      .set("Cookie", cookie)
      .send({ phone: "6281234567890" });
    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      error: "INVALID_ORIGIN",
      message: "Cookie-authenticated requests must come from the Wago origin",
    });
  });

  it("accepts cookie-authenticated state changes from the detected Wago origin", async () => {
    resetAccessStateForTest({ apiKey: "test-key", apiKeySource: "env" });
    config.adminPassword = productionAdminPassword;
    const login = await request(app).post("/app/session").send({ password: productionAdminPassword });
    const cookie = firstCookie(login);
    const response = await request(app)
      .post("/recipients/allow")
      .set("Host", "wago.example.com")
      .set("Origin", "https://wago.example.com")
      .set("Cookie", cookie)
      .send({ phone: "6281234567890" });
    expect(response.status).toBe(201);
  });

  it("requires WAGO_ADMIN_PASSWORD for a fresh production dashboard", async () => {
    config.nodeEnv = "production";
    config.adminPassword = null;
    const login = await request(app)
      .post("/app/session")
      .set("Host", "wago.example.com")
      .set("Origin", "https://wago.example.com")
      .send({ password: productionAdminPassword });
    expect(login.status).toBe(503);
    expect(login.body.error).toBe("ADMIN_PASSWORD_REQUIRED");

    const response = await request(app)
      .post("/app/bootstrap")
      .set("Host", "wago.example.com")
      .set("Origin", "https://wago.example.com")
      .send({ apiKey: pairingCandidate });
    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      error: "ADMIN_PASSWORD_REQUIRED",
      message: "Configure WAGO_ADMIN_PASSWORD before first pairing.",
    });
  });

  it("rejects bootstrap after an API key exists", async () => {
    resetAccessStateForTest({ apiKey: "existing-key", apiKeySource: "env" });
    const response = await request(app).post("/app/bootstrap").send({ apiKey: pairingCandidate });
    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      error: "APP_ALREADY_INITIALIZED",
      message: "This app already has a machine API key. Sign in to the dashboard with the configured admin credential.",
    });
  });
});
