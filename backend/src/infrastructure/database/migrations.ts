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
  {
    version: 4,
    sql: `
      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        message_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'delivering', 'delivered', 'failed', 'expired')),
        attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
        redelivery_count INTEGER NOT NULL DEFAULT 0 CHECK (redelivery_count >= 0),
        next_attempt_at INTEGER,
        first_attempt_at INTEGER,
        last_attempt_at INTEGER,
        last_status_code INTEGER,
        last_error_code TEXT,
        created_at INTEGER NOT NULL,
        delivered_at INTEGER,
        expires_at INTEGER NOT NULL,
        claimed_at INTEGER
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_deliveries_message_event
        ON webhook_deliveries(message_id, event_type);
      CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_due
        ON webhook_deliveries(status, next_attempt_at);
      CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created
        ON webhook_deliveries(created_at DESC);
    `,
  },
  {
    version: 5,
    sql: `
      CREATE TABLE IF NOT EXISTS browser_sessions (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        revoked_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_browser_sessions_expires_at
        ON browser_sessions(expires_at);
    `,
  },
  {
    version: 6,
    sql: `
      CREATE TABLE IF NOT EXISTS webhook_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
        url TEXT,
        secret TEXT,
        previous_secret TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 7,
    sql: `
      CREATE TABLE IF NOT EXISTS gateway_instance_lease (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        owner_id TEXT NOT NULL,
        acquired_at INTEGER NOT NULL,
        heartbeat_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
    `,
  },
  {
    version: 8,
    sql: `
      ALTER TABLE app_settings
        ADD COLUMN setup_code_hash TEXT;
      ALTER TABLE app_settings
        ADD COLUMN setup_code_generated_at TEXT;
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
