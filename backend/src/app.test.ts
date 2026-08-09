import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "./app.js";
import { config } from "./config.js";

const apiKeyRequiredResponse = {
  success: false,
  error: "API_KEY_REQUIRED",
  message: "Initialize the app from the web UI or set API_KEY on the backend before using this operation"
};

describe("app", () => {
  beforeEach(() => {
    config.apiKey = null;
    config.apiKeySource = "unset";
  });

  it("returns health status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
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
      message: "Request body must be valid JSON"
    });
  });

  it("protects send-message when API_KEY is not configured", async () => {
    const response = await request(app).post("/messages/send").send({
      to: "081234567890",
      text: "Connectivity check"
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual(apiKeyRequiredResponse);
  });

  it("protects destructive WhatsApp rebind when API_KEY is not configured", async () => {
    const response = await request(app).post("/whatsapp/rebind");

    expect(response.status).toBe(403);
    expect(response.body).toEqual(apiKeyRequiredResponse);
  });

  it("returns a JSON 404 for expired or unknown message status", async () => {
    const response = await request(app).get("/messages/unknown-message-id/status");

    expect(response.status).toBe(403);
    expect(response.body).toEqual(apiKeyRequiredResponse);
  });

  it("bootstraps a generated API key when the app has not been initialized", async () => {
    const response = await request(app).post("/app/bootstrap");

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.appId).toBe(config.appId);
    expect(response.body.apiKey).toMatch(/^wa_/);
    expect(response.headers["set-cookie"]?.[0]).toContain(config.authCookieName);
    expect(config.apiKey).toBe(response.body.apiKey);
    expect(config.apiKeySource).toBe("generated");
  });

  it("rejects bootstrap after an API key exists", async () => {
    config.apiKey = "existing-key";
    config.apiKeySource = "env";

    const response = await request(app).post("/app/bootstrap");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      error: "APP_ALREADY_INITIALIZED",
      message: "This app is already initialized. Use the existing API key or auth cookie."
    });
  });
});
