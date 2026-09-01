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
      { version: 12 },
      { version: 13 },
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

    const webhookAttemptColumns = database.prepare("PRAGMA table_info(webhook_delivery_attempts)").all() as Array<{
      name: string;
    }>;
    expect(webhookAttemptColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "id",
        "delivery_id",
        "sequence",
        "redelivery_number",
        "outcome",
        "started_at",
        "completed_at",
        "status_code",
        "error_code",
        "retryable",
        "next_attempt_at",
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

  it("redacts message.received payloads atomically when a delivery becomes terminal", () => {
    const database = new DatabaseSync(":memory:");
    runMigrations(database, migrations);

    database
      .prepare(`
        INSERT INTO webhook_deliveries (
          id, schema_version, event_type, message_id, payload_json, status,
          attempt_count, redelivery_count, next_attempt_at, created_at, expires_at
        ) VALUES (?, 1, 'message.received', ?, ?, 'pending', 0, 0, ?, ?, ?)
      `)
      .run("delivery-inbound", "in_message", '{"data":{"from":"6281","text":"secret"}}', 1, 1, 1000);

    database.prepare("UPDATE webhook_deliveries SET status = 'delivered' WHERE id = ?").run("delivery-inbound");

    const row = database.prepare("SELECT payload_json FROM webhook_deliveries WHERE id = ?").get("delivery-inbound") as {
      payload_json: string;
    };
    expect(row.payload_json).toBe("{}");

    database.close();
  });
});
