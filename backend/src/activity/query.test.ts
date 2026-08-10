import { afterEach, describe, expect, it } from "vitest";
import { recordActivity, resetActivityLogForTest } from "./store.js";
import { listAudit } from "./query.js";

describe("audit query", () => {
  afterEach(async () => {
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
      q: "logout",
    });

    expect(page.events.map((event) => event.code)).toEqual(["baileys.connection.close"]);
  });

  it("paginates newest-first without duplicate rows when timestamps are equal", async () => {
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
    expect(first.nextCursor).toBeDefined();

    const second = await listAudit({ limit: 2, before: first.nextCursor });
    expect(second.events).toHaveLength(2);

    const ids = [...first.events, ...second.events].map((event) => event.id);
    expect(new Set(ids).size).toBe(4);
  });

  it("rejects an invalid cursor", async () => {
    await expect(listAudit({ limit: 20, before: "not-a-valid-cursor" })).rejects.toMatchObject({
      name: "INVALID_AUDIT_CURSOR",
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
