import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplicationError } from "../errors/application-error.js";
import { logger } from "../infrastructure/logger.js";
import { apiErrorHandler } from "./error-handler.js";

function makeApp() {
  const app = express();

  app.get("/expected", () => {
    throw new ApplicationError("WHATSAPP_NOT_CONNECTED", "WhatsApp is not connected");
  });

  app.get("/unexpected", () => {
    throw new Error("database password leaked here");
  });

  app.use(apiErrorHandler);
  return app;
}

describe("apiErrorHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders typed application errors through the stable HTTP mapper", async () => {
    const response = await request(makeApp()).get("/expected");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      error: "WHATSAPP_NOT_CONNECTED",
      message: "WhatsApp is not connected",
    });
  });

  it("sanitizes unexpected failures in both the response and structured log context", async () => {
    const logError = vi.spyOn(logger, "error").mockImplementation(() => logger);
    const response = await request(makeApp()).get("/unexpected");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Internal server error",
    });
    expect(JSON.stringify(response.body)).not.toContain("database password");

    expect(logError).toHaveBeenCalledTimes(1);
    const [context] = logError.mock.calls[0] ?? [];
    expect(context).toMatchObject({
      event: "http.unhandled_error",
      method: "GET",
      path: "/unexpected",
      errorType: "Error",
    });
    expect(context).not.toHaveProperty("error");
  });
});
