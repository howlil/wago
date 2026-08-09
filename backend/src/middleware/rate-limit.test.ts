import type { Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRateLimit } from "./rate-limit.js";

function createRequest(ip: string): Request {
  return {
    ip,
    socket: {
      remoteAddress: ip
    }
  } as Request;
}

function createResponse(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis()
  } as unknown as Response;
}

describe("createRateLimit", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("limits requests within the same window", () => {
    const middleware = createRateLimit({ limit: 1, windowMs: 60_000 });
    const next = vi.fn();
    const response = createResponse();

    middleware(createRequest("10.0.0.1"), response, next);
    middleware(createRequest("10.0.0.1"), response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      error: "RATE_LIMITED",
      message: "Too many requests. Try again later."
    });
  });

  it("evicts old entries when maxEntries is exceeded", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const middleware = createRateLimit({ limit: 1, windowMs: 10_000, maxEntries: 1 });
    const next = vi.fn();

    middleware(createRequest("10.0.0.1"), createResponse(), next);
    vi.setSystemTime(1);
    middleware(createRequest("10.0.0.2"), createResponse(), next);
    vi.setSystemTime(10_000);
    middleware(createRequest("10.0.0.3"), createResponse(), next);
    vi.setSystemTime(10_001);

    const response = createResponse();
    middleware(createRequest("10.0.0.1"), response, next);

    expect(response.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(4);
  });
});
