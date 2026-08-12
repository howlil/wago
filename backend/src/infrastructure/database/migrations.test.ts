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
    expect(rows).toEqual([
      { version: 1 },
      { version: 2 },
      { version: 3 },
      { version: 4 },
      { version: 5 },
      { version: 6 },
    ]);

    const webhookColumns = database.prepare("PRAGMA table_info(webhook_deliveries)").all() as Array<{ name: string }>;
    expect(webhookColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "id",
        "schema_version",
        "event_type",
        "message_id",
        "payload_json",
        "status",
        "attempt_count",
        "next_attempt_at",
        "expires_at",
        "redelivery_count",
      ]),
    );

    const browserSessionColumns = database.prepare("PRAGMA table_info(browser_sessions)").all() as Array<{
      name: string;
    }>;
    expect(browserSessionColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["id", "token_hash", "created_at", "last_seen_at", "expires_at", "revoked_at"]),
    );

    const webhookSettingsColumns = database.prepare("PRAGMA table_info(webhook_settings)").all() as Array<{
      name: string;
    }>;
    expect(webhookSettingsColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["id", "enabled", "url", "secret", "previous_secret", "created_at", "updated_at"]),
    );
    database.close();
  });
});
