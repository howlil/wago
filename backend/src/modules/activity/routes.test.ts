import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../app.js";
import { resetAccessStateForTest } from "../access/api-key.js";
import { recordActivity, resetActivityLogForTest } from "./store.js";

describe("activity routes", () => {
  beforeEach(async () => {
    resetAccessStateForTest({ apiKey: "audit-test-key", apiKeySource: "env" });
    await resetActivityLogForTest();
  });

  afterEach(async () => {
    await resetActivityLogForTest();
  });

  it("requires API authentication", async () => {
    const response = await request(app).get("/activity");
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, error: "UNAUTHORIZED" });
  });

  it("filters audit events and returns cursor pagination", async () => {
    for (const code of ["close.one", "close.two", "close.three"]) {
      await recordActivity({
        source: "baileys",
        level: "warning",
        category: "connection",
        code,
        title: "Connection closed",
        description: "Logged out connection event",
      });
    }
    await recordActivity({
      level: "info",
      category: "system",
      code: "gateway.started",
      title: "Gateway started",
      description: "Wago ready",
    });

    const first = await request(app)
      .get("/activity")
      .query({ limit: 2, source: "baileys", category: "connection", level: "warning", q: "logged" })
      .set("Authorization", "Bearer audit-test-key");

    expect(first.status).toBe(200);
    expect(first.body.success).toBe(true);
    expect(first.body.events).toHaveLength(2);
    expect(first.body.events.every((event: { source?: string }) => event.source === "baileys")).toBe(true);
    expect(first.body.nextCursor).toEqual(expect.any(String));

    const second = await request(app)
      .get("/activity")
      .query({
        limit: 2,
        source: "baileys",
        category: "connection",
        level: "warning",
        q: "logged",
        before: first.body.nextCursor,
      })
      .set("Authorization", "Bearer audit-test-key");

    expect(second.status).toBe(200);
    expect(second.body.events).toHaveLength(1);
    expect(second.body.nextCursor).toBeUndefined();
  });

  it("rejects invalid audit filters", async () => {
    const response = await request(app)
      .get("/activity")
      .query({ source: "raw-baileys-packets" })
      .set("Authorization", "Bearer audit-test-key");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: "INVALID_AUDIT_FILTER",
      message: "Audit filter is invalid",
    });
  });

  it("rejects malformed cursors", async () => {
    const response = await request(app)
      .get("/activity")
      .query({ before: "not-a-cursor" })
      .set("Authorization", "Bearer audit-test-key");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: "INVALID_AUDIT_CURSOR",
      message: "Audit cursor is invalid",
    });
  });

  it("clamps limit to the supported page size", async () => {
    await recordActivity({
      level: "info",
      category: "system",
      code: "single",
      title: "Single",
      description: "Single event",
    });

    const response = await request(app)
      .get("/activity")
      .query({ limit: 9999 })
      .set("Authorization", "Bearer audit-test-key");

    expect(response.status).toBe(200);
    expect(response.body.events).toHaveLength(1);
  });
});
