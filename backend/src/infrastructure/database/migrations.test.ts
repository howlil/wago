import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { migrations, runMigrations } from "./migrations.js";

describe("database migrations", () => {
  it("applies released migrations exactly once", () => {
    const database = new DatabaseSync(":memory:");
    database.exec("PRAGMA foreign_keys = ON");

    runMigrations(database, migrations);
    runMigrations(database, migrations);

    const rows = database.prepare("SELECT version FROM schema_migrations ORDER BY version").all();
    expect(rows).toEqual([{ version: 1 }, { version: 2 }, { version: 3 }]);
    database.close();
  });
});
