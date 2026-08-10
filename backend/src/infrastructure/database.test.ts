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
    expect(migrations.map((migration) => migration.version)).toEqual([1, 2]);
    expect(
      database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'outbound_events'").get(),
    ).toBeDefined();
    expect(
      database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'idempotency_keys'").get(),
    ).toBeDefined();
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
