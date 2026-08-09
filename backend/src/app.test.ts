import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./app.js";

describe("app", () => {
  it("returns health status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("allows browser clients to consume the API during local development", async () => {
    const response = await request(app).get("/whatsapp/status").set("Origin", "http://127.0.0.1:5173");

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

  it("returns WHATSAPP_NOT_CONNECTED when sending while disconnected", async () => {
    const response = await request(app).post("/messages/send").send({
      to: "081234567890",
      text: "Connectivity check"
    });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      error: "WHATSAPP_NOT_CONNECTED",
      message: "WhatsApp is not connected"
    });
  });
});
