import { afterEach, describe, expect, it, vi } from "vitest";
import { listAudit } from "./query.js";
import { recordActivity, resetActivityLogForTest } from "./store.js";

describe("audit query", () => {
  afterEach(async () => {
    vi.useRealTimers();
    await resetActivityLogForTest();
  });

  it("filters by source category level and bounded text search", async () => {
    await recordActivity({
      source: "baileys",
      level: "warning",
      category: "connection",
      code: "baileys.connection.close",
      title: "WhatsApp connection closed",
      description: "Logged out session requires pairing.",
    });
    await recordActivity({
      level: "info",
      category: "system",
      code: "gateway.started",
      title: "Gateway started",
      description: "Wago is ready.",
    });

    const page = await listAudit({
      limit: 20,
      source: "baileys",
      category: "connection",
      level: "warning",
      q: "logged",
    });

    expect(page.events.map((event) => event.code)).toEqual(["baileys.connection.close"]);
  });

  it("paginates newest-first without duplicate rows when timestamps are equal", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T12:00:00.000Z"));

    for (const code of ["one", "two", "three", "four"]) {
      await recordActivity({
        level: "info",
        category: "system",
        code,
        title: code,
        description: code,
      });
    }

    const first = await listAudit({ limit: 2 });
    expect(first.events).toHaveLength(2);
    expect(first.events.every((event) => event.timestamp === "2026-08-10T12:00:00.000Z")).toBe(true);
    expect(first.nextCursor).toBeDefined();

    const second = await listAudit({ limit: 2, before: first.nextCursor });
    expect(second.events).toHaveLength(2);

    const ids = [...first.events, ...second.events].map((event) => event.id);
    expect(new Set(ids).size).toBe(4);
  });

  it("rejects an invalid cursor", async () => {
    await expect(listAudit({ limit: 20, before: "not-a-valid-cursor" })).rejects.toMatchObject({
      name: "ApplicationError",
      code: "INVALID_AUDIT_CURSOR",
    });
  });

  it("caps search input at 100 characters", async () => {
    await recordActivity({
      level: "info",
      category: "system",
      code: "bounded.search",
      title: "Bounded search",
      description: "needle",
    });

    const page = await listAudit({ limit: 20, q: `needle${"x".repeat(200)}` });
    expect(page.events).toEqual([]);
  });
});
