import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRateLimit } from "./rate-limit.js";

describe("createRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  it("limits repeated requests and clears expired entries", async () => {
    const app = express();
    app.use(createRateLimit({ limit: 1, windowMs: 1_000, maxEntries: 2 }));
    app.get("/health", (_req, res) => res.json({ ok: true }));

    await request(app).get("/health").expect(200);
    await request(app).get("/health").expect(429);

    vi.advanceTimersByTime(1_001);

    await request(app).get("/health").expect(200);
  });

  it("bounds the number of tracked clients", async () => {
    const app = express();
    app.use((req, _res, next) => {
      Object.defineProperty(req, "ip", {
        configurable: true,
        value: req.header("x-test-ip") ?? "unknown",
      });
      next();
    });
    app.use(createRateLimit({ limit: 1, windowMs: 60_000, maxEntries: 2 }));
    app.get("/health", (_req, res) => res.json({ ok: true }));

    await request(app).get("/health").set("x-test-ip", "10.0.0.1").expect(200);
    await request(app).get("/health").set("x-test-ip", "10.0.0.2").expect(200);
    await request(app).get("/health").set("x-test-ip", "10.0.0.3").expect(200);
    await request(app).get("/health").set("x-test-ip", "10.0.0.1").expect(200);
  });
});
