import { chmodSync, mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { databaseFile, dataDirectory } from "../config/runtime-paths.js";
import { importLegacyJsonState } from "./legacy-json-import.js";
import { runMigrations } from "./database/migrations.js";
import { withTransaction as withDatabaseTransaction } from "./database/transaction.js";

const DATABASE_TIMEOUT_MS = 5_000;

mkdirSync(dataDirectory, { recursive: true });

const database = new DatabaseSync(databaseFile, {
  timeout: DATABASE_TIMEOUT_MS,
});
chmodSync(databaseFile, 0o600);

database.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA temp_store = MEMORY;
`);

runMigrations(database);
importLegacyJsonState(database, dataDirectory);

export function getDatabase(): DatabaseSync {
  return database;
}

export function withTransaction<T>(operation: () => T): T {
  return withDatabaseTransaction(database, operation);
}

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
