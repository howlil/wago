import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { importLegacyJsonState } from "./legacy-json-import.js";

const temporaryDirectories: string[] = [];

function createMigrationDatabase(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE application_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE app_settings (
      id INTEGER PRIMARY KEY,
      app_id TEXT NOT NULL,
      api_key_hash TEXT,
      generated_at TEXT
    );
    CREATE TABLE whatsapp_binding (
      id INTEGER PRIMARY KEY,
      state TEXT NOT NULL,
      jid TEXT,
      phone TEXT,
      bound_at TEXT
    );
    CREATE TABLE recipients (
      jid TEXT PRIMARY KEY,
      resolved_jid TEXT,
      label TEXT,
      allowed INTEGER NOT NULL,
      opted_out INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_successful_outbound_at TEXT
    );
    CREATE TABLE idempotency_keys (
      key TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE outbound_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_jid TEXT NOT NULL,
      accepted_at INTEGER NOT NULL,
      is_new_recipient INTEGER NOT NULL
    );
    CREATE TABLE recipient_reachout_cooldowns (
      jid TEXT PRIMARY KEY,
      restricted_until INTEGER NOT NULL
    );
    CREATE TABLE gateway_policy_state (
      id INTEGER PRIMARY KEY,
      outbound_paused INTEGER NOT NULL,
      outbound_pause_message TEXT NOT NULL
    );
    INSERT INTO gateway_policy_state (id, outbound_paused, outbound_pause_message)
    VALUES (1, 0, 'Outbound messaging is paused');
    CREATE TABLE activity_events (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      level TEXT NOT NULL,
      category TEXT NOT NULL,
      code TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      metadata_json TEXT
    );
  `);
  return database;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("legacy JSON import", () => {
  it("imports existing durable state into normalized SQLite tables only once", () => {
    const directory = mkdtempSync(join(tmpdir(), "wago-legacy-"));
    temporaryDirectories.push(directory);
    const database = createMigrationDatabase();
    const jid = "628123@s.whatsapp.net";

    writeFileSync(
      resolve(directory, "app-settings.json"),
      JSON.stringify({ version: 1, data: { appId: "wa-gateway-legacy", apiKeyHash: "abc123" } }),
    );
    writeFileSync(
      resolve(directory, "recipients.json"),
      JSON.stringify({
        version: 1,
        data: {
          [jid]: {
            jid,
            allowed: true,
            optedOut: false,
            createdAt: "2026-08-10T00:00:00.000Z",
            updatedAt: "2026-08-10T00:00:00.000Z",
            lastSuccessfulOutboundAt: "2026-08-10T00:00:01.000Z",
          },
        },
      }),
    );
    writeFileSync(
      resolve(directory, "outbound-policy.json"),
      JSON.stringify({
        version: 1,
        data: {
          seenIdempotencyKeys: { "legacy-key": 10_000 },
          accountSendTimestamps: [1_000],
          recipientSendTimestamps: { [jid]: [1_000] },
          knownRecipients: { [jid]: 1_000 },
          newChatTimestamps: [1_000],
          recipientReachoutCooldowns: { [jid]: 5_000 },
          outboundPaused: true,
          outboundPauseMessage: "maintenance",
        },
      }),
    );

    importLegacyJsonState(database, directory);

    expect(database.prepare("SELECT app_id, api_key_hash FROM app_settings WHERE id = 1").get()).toEqual({
      app_id: "wa-gateway-legacy",
      api_key_hash: "abc123",
    });
    expect(
      database.prepare("SELECT jid, allowed, last_successful_outbound_at FROM recipients WHERE jid = ?").get(jid),
    ).toEqual({
      jid,
      allowed: 1,
      last_successful_outbound_at: "2026-08-10T00:00:01.000Z",
    });
    expect(database.prepare("SELECT key, expires_at FROM idempotency_keys WHERE key = ?").get("legacy-key")).toEqual({
      key: "legacy-key",
      expires_at: 10_000,
    });
    expect(
      database
        .prepare("SELECT recipient_jid, accepted_at, is_new_recipient FROM outbound_events WHERE recipient_jid = ?")
        .get(jid),
    ).toEqual({
      recipient_jid: jid,
      accepted_at: 1_000,
      is_new_recipient: 1,
    });
    expect(
      database.prepare("SELECT jid, restricted_until FROM recipient_reachout_cooldowns WHERE jid = ?").get(jid),
    ).toEqual({ jid, restricted_until: 5_000 });
    expect(
      database
        .prepare("SELECT outbound_paused, outbound_pause_message FROM gateway_policy_state WHERE id = 1")
        .get(),
    ).toEqual({ outbound_paused: 1, outbound_pause_message: "maintenance" });

    writeFileSync(resolve(directory, "app-settings.json"), JSON.stringify({ appId: "wa-gateway-overwrite-attempt" }));
    importLegacyJsonState(database, directory);

    expect(database.prepare("SELECT app_id FROM app_settings WHERE id = 1").get()).toEqual({
      app_id: "wa-gateway-legacy",
    });
    expect(database.prepare("SELECT COUNT(*) AS count FROM outbound_events").get()).toEqual({ count: 1 });

    database.close();
  });
});
