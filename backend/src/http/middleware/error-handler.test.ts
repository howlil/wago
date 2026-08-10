import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { ApplicationError } from "../../errors/application-error.js";
import { asyncHandler } from "./async-handler.js";
import { errorHandler } from "./error-handler.js";

function makeApp() {
  const app = express();
  app.use(express.json({ limit: "1kb" }));
  app.post("/echo", (_req, res) => res.json({ success: true }));
  app.get(
    "/typed",
    asyncHandler(async () => {
      throw new ApplicationError("INVALID_PHONE", "Invalid phone number");
    }),
  );
  app.get(
    "/unknown",
    asyncHandler(async () => {
      throw new Error("secret internal detail");
    }),
  );
  app.use(errorHandler);
  return app;
}

describe("shared HTTP error middleware", () => {
  it("normalizes malformed JSON", async () => {
    const response = await request(makeApp()).post("/echo").set("Content-Type", "application/json").send("{bad");
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: "INVALID_JSON",
      message: "Request body must be valid JSON",
    });
  });

  it("normalizes oversized JSON", async () => {
    const response = await request(makeApp())
      .post("/echo")
      .send({ value: "x".repeat(2_000) });
    expect(response.status).toBe(413);
    expect(response.body).toEqual({
      success: false,
      error: "PAYLOAD_TOO_LARGE",
      message: "Request body is too large",
    });
  });

  it("maps typed application errors", async () => {
    const response = await request(makeApp()).get("/typed");
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: "INVALID_PHONE",
      message: "Invalid phone number",
    });
  });

  it("sanitizes unknown errors using the existing public contract", async () => {
    const response = await request(makeApp()).get("/unknown");
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Internal server error",
    });
    expect(JSON.stringify(response.body)).not.toContain("secret internal detail");
  });
});
