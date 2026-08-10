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
    CREATE TABLE outbound_policy_state (
      id INTEGER PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
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
  it("imports existing durable state once without overwriting SQLite afterwards", () => {
    const directory = mkdtempSync(join(tmpdir(), "wago-legacy-"));
    temporaryDirectories.push(directory);
    const database = createMigrationDatabase();

    writeFileSync(
      resolve(directory, "app-settings.json"),
      JSON.stringify({ version: 1, data: { appId: "wa-gateway-legacy", apiKeyHash: "abc123" } }),
    );
    writeFileSync(
      resolve(directory, "recipients.json"),
      JSON.stringify({
        version: 1,
        data: {
          "628123@s.whatsapp.net": {
            jid: "628123@s.whatsapp.net",
            allowed: true,
            optedOut: false,
            createdAt: "2026-08-10T00:00:00.000Z",
            updatedAt: "2026-08-10T00:00:00.000Z",
          },
        },
      }),
    );

    importLegacyJsonState(database, directory);

    const settings = database.prepare("SELECT app_id, api_key_hash FROM app_settings WHERE id = 1").get() as {
      app_id?: string;
      api_key_hash?: string;
    };
    const recipient = database.prepare("SELECT jid, allowed FROM recipients WHERE jid = ?").get(
      "628123@s.whatsapp.net",
    ) as { jid?: string; allowed?: number };

    expect(settings).toEqual({ app_id: "wa-gateway-legacy", api_key_hash: "abc123" });
    expect(recipient).toEqual({ jid: "628123@s.whatsapp.net", allowed: 1 });

    writeFileSync(
      resolve(directory, "app-settings.json"),
      JSON.stringify({ appId: "wa-gateway-overwrite-attempt" }),
    );
    importLegacyJsonState(database, directory);

    expect(database.prepare("SELECT app_id FROM app_settings WHERE id = 1").get()).toEqual({
      app_id: "wa-gateway-legacy",
    });

    database.close();
  });
});
