import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { migrations, runMigrations } from "./migrations.js";

describe("setup-code migration", () => {
  it("persists only setup-code hash metadata in app_settings", () => {
    const database = new DatabaseSync(":memory:");
    runMigrations(database, migrations);

    const versions = database.prepare("SELECT version FROM schema_migrations ORDER BY version").all();
    expect(versions).toContainEqual({ version: 8 });

    const columns = database.prepare("PRAGMA table_info(app_settings)").all() as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["setup_code_hash", "setup_code_generated_at"]),
    );
    expect(columns.map((column) => column.name)).not.toContain("setup_code");

    database.close();
  });
});
