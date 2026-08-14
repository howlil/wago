import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getDatabase, withTransaction } from "./database.js";

const database = getDatabase();

describe("SQLite persistence", () => {
  it("uses WAL mode and applies all schema migrations", () => {
    const journal = database.prepare("PRAGMA journal_mode").get() as { journal_mode?: string } | undefined;
    const migrations = database.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as Array<{
      version?: number;
    }>;

    expect(journal?.journal_mode).toBe("wal");
    expect(migrations.map((migration) => migration.version)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'outbound_events'").get()).toBeDefined();
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'idempotency_keys'").get()).toBeDefined();
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'webhook_deliveries'").get()).toBeDefined();
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'browser_sessions'").get()).toBeDefined();
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'webhook_settings'").get()).toBeDefined();
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'gateway_instance_lease'").get()).toBeDefined();
  });

  it("adds audit source and filter indexes", () => {
    const columns = database.prepare("PRAGMA table_info(activity_events)").all() as Array<{ name?: string }>;
    const indexes = database.prepare("PRAGMA index_list(activity_events)").all() as Array<{ name?: string }>;
    const columnNames = new Set(columns.map((column) => column.name));
    const indexNames = new Set(indexes.map((index) => index.name));

    expect(columnNames.has("source")).toBe(true);
    expect(indexNames.has("idx_activity_timestamp")).toBe(true);
    expect(indexNames.has("idx_activity_source_timestamp")).toBe(true);
    expect(indexNames.has("idx_activity_category_timestamp")).toBe(true);
    expect(indexNames.has("idx_activity_level_timestamp")).toBe(true);
  });

  it("rolls back a failed transaction", () => {
    const key = `rollback-${randomUUID()}`;

    expect(() =>
      withTransaction(() => {
        database.prepare("INSERT INTO application_meta (key, value) VALUES (?, ?)").run(key, "temporary");
        throw new Error("rollback");
      }),
    ).toThrow("rollback");

    expect(database.prepare("SELECT value FROM application_meta WHERE key = ?").get(key)).toBeUndefined();
  });
});
