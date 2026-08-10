import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getDatabase, withTransaction } from "./database.js";

const database = getDatabase();

describe("SQLite persistence", () => {
  it("uses WAL mode and applies schema migrations", () => {
    const journal = database.prepare("PRAGMA journal_mode").get() as { journal_mode?: string } | undefined;
    const migration = database.prepare("SELECT version FROM schema_migrations WHERE version = 1").get() as
      | { version?: number }
      | undefined;

    expect(journal?.journal_mode).toBe("wal");
    expect(migration?.version).toBe(1);
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
