import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dataDirectory, databaseFile } from "../config/runtime-paths.js";

const DATABASE_TIMEOUT_MS = 5_000;

mkdirSync(dataDirectory, { recursive: true });

const database = new DatabaseSync(databaseFile, {
  timeout: DATABASE_TIMEOUT_MS,
});

database.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA temp_store = MEMORY;

  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
`);

type Migration = {
  version: number;
  sql: string;
};

const migrations: Migration[] = [
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

      CREATE TABLE IF NOT EXISTS outbound_policy_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

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
];

export function getDatabase(): DatabaseSync {
  return database;
}

export function withTransaction<T>(operation: () => T): T {
  if (database.isTransaction) {
    return operation();
  }

  database.exec("BEGIN IMMEDIATE");

  try {
    const result = operation();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function runMigrations(): void {
  const hasMigration = database.prepare("SELECT 1 FROM schema_migrations WHERE version = ?");
  const recordMigration = database.prepare(
    "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
  );

  for (const migration of migrations) {
    if (hasMigration.get(migration.version)) {
      continue;
    }

    withTransaction(() => {
      database.exec(migration.sql);
      recordMigration.run(migration.version, new Date().toISOString());
    });
  }
}

runMigrations();

export function checkpointDatabase(): void {
  database.exec("PRAGMA wal_checkpoint(PASSIVE)");
}

export function closeDatabase(): void {
  if (!database.isOpen) {
    return;
  }

  try {
    database.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  } finally {
    database.close();
  }
}
