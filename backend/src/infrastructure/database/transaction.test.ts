import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { withTransaction } from "./transaction.js";

describe("database transaction helper", () => {
  it("rolls back all writes when the operation fails", () => {
    const database = new DatabaseSync(":memory:");
    database.exec("CREATE TABLE values_for_test (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
    const key = randomUUID();

    expect(() =>
      withTransaction(database, () => {
        database.prepare("INSERT INTO values_for_test (key, value) VALUES (?, ?)").run(key, "temporary");
        throw new Error("boom");
      }),
    ).toThrow("boom");

    expect(database.prepare("SELECT value FROM values_for_test WHERE key = ?").get(key)).toBeUndefined();
    database.close();
  });
});
