import type { DatabaseSync } from "node:sqlite";
import { withTransaction } from "./transaction.js";

export type Migration = {
  version: number;
  sql: string;
};

export const migrations: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS application_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        app_id TEXT NOT NULL,
        api_key_hash TEXT,
        generated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS whatsapp_binding (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        state TEXT NOT NULL CHECK (state IN ('unbound', 'bound')),
        jid TEXT,
        phone TEXT,
        bound_at TEXT
      );

      CREATE TABLE IF NOT EXISTS recipients (
        jid TEXT PRIMARY KEY,
        resolved_jid TEXT,
        label TEXT,
        allowed INTEGER NOT NULL CHECK (allowed IN (0, 1)),
        opted_out INTEGER NOT NULL CHECK (opted_out IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_successful_outbound_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_recipients_updated_at
        ON recipients(updated_at DESC);

      CREATE TABLE IF NOT EXISTS activity_events (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        level TEXT NOT NULL,
        category TEXT NOT NULL,
        code TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        metadata_json TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_activity_timestamp
        ON activity_events(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_category_timestamp
        ON activity_events(category, timestamp DESC);
    `,
  },
  {
    version: 2,
    sql: `
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at
        ON idempotency_keys(expires_at);

      CREATE TABLE IF NOT EXISTS outbound_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipient_jid TEXT NOT NULL,
        accepted_at INTEGER NOT NULL,
        is_new_recipient INTEGER NOT NULL CHECK (is_new_recipient IN (0, 1))
      );

      CREATE INDEX IF NOT EXISTS idx_outbound_events_accepted_at
        ON outbound_events(accepted_at);
      CREATE INDEX IF NOT EXISTS idx_outbound_events_recipient_time
        ON outbound_events(recipient_jid, accepted_at);
      CREATE INDEX IF NOT EXISTS idx_outbound_events_new_chat_time
        ON outbound_events(is_new_recipient, accepted_at);

      CREATE TABLE IF NOT EXISTS recipient_reachout_cooldowns (
        jid TEXT PRIMARY KEY,
        restricted_until INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_reachout_cooldowns_until
        ON recipient_reachout_cooldowns(restricted_until);

      CREATE TABLE IF NOT EXISTS gateway_policy_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        outbound_paused INTEGER NOT NULL CHECK (outbound_paused IN (0, 1)),
        outbound_pause_message TEXT NOT NULL
      );

      INSERT OR IGNORE INTO gateway_policy_state (id, outbound_paused, outbound_pause_message)
      VALUES (1, 0, 'Outbound messaging is paused');
    `,
  },
  {
    version: 3,
    sql: `
      ALTER TABLE activity_events
        ADD COLUMN source TEXT NOT NULL DEFAULT 'wago';

      CREATE INDEX IF NOT EXISTS idx_activity_source_timestamp
        ON activity_events(source, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_level_timestamp
        ON activity_events(level, timestamp DESC);
    `,
  },
];

export function runMigrations(database: DatabaseSync, migrationList: Migration[] = migrations): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const hasMigration = database.prepare("SELECT 1 FROM schema_migrations WHERE version = ?");
  const recordMigration = database.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)");

  for (const migration of migrationList) {
    if (hasMigration.get(migration.version)) {
      continue;
    }

    withTransaction(database, () => {
      database.exec(migration.sql);
      recordMigration.run(migration.version, new Date().toISOString());
    });
  }
}
