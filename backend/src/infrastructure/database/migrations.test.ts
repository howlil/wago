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
      { version: 7 },
      { version: 8 },
      { version: 9 },
      { version: 10 },
      { version: 11 },
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

    const messageColumns = database.prepare("PRAGMA table_info(outbound_messages)").all() as Array<{ name: string }>;
    expect(messageColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "id",
        "provider_message_id",
        "recipient_jid",
        "resolved_jid",
        "status",
        "dispatch_state",
        "error_code",
        "error_message",
        "created_at",
        "updated_at",
        "accepted_at",
        "rejected_at",
      ]),
    );

    const idempotencyColumns = database.prepare("PRAGMA table_info(idempotency_keys)").all() as Array<{ name: string }>;
    expect(idempotencyColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["key", "expires_at", "message_id"]),
    );

    const appSettingsColumns = database.prepare("PRAGMA table_info(app_settings)").all() as Array<{ name: string }>;
    expect(appSettingsColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "id",
        "app_id",
        "api_key_hash",
        "generated_at",
        "setup_code_hash",
        "setup_code_generated_at",
        "admin_password_hash",
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

    const instanceLeaseColumns = database.prepare("PRAGMA table_info(gateway_instance_lease)").all() as Array<{
      name: string;
    }>;
    expect(instanceLeaseColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["id", "owner_id", "acquired_at", "heartbeat_at", "expires_at"]),
    );

    database.close();
  });
});
