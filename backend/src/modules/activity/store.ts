import { randomUUID } from "node:crypto";
import { getDatabase, withTransaction } from "../../infrastructure/database.js";
import { redactLogFields } from "../../infrastructure/logger.js";
import type {
  ActivityCategory,
  ActivityLevel,
  AuditEvent,
  AuditInput,
  AuditMetadata,
  AuditSource,
} from "./audit-event.js";

export type { ActivityCategory, ActivityLevel, AuditSource } from "./audit-event.js";
export type ActivityMetadata = AuditMetadata;
export type ActivityEvent = AuditEvent;
export type ActivityInput = AuditInput;

type ActivityRow = {
  id: string;
  timestamp: string;
  level: ActivityLevel;
  category: ActivityCategory;
  source: AuditSource;
  code: string;
  title: string;
  description: string;
  metadata_json: string | null;
};

const MAX_ACTIVITY_EVENTS = 2_000;
const database = getDatabase();
const insertActivity = database.prepare(`
  INSERT INTO activity_events (
    id, timestamp, level, category, source, code, title, description, metadata_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const pruneActivity = database.prepare(`
  DELETE FROM activity_events
  WHERE rowid IN (
    SELECT rowid FROM activity_events
    ORDER BY timestamp DESC, rowid DESC
    LIMIT -1 OFFSET ?
  )
`);
const selectActivity = database.prepare(`
  SELECT id, timestamp, level, category, source, code, title, description, metadata_json
  FROM activity_events
  ORDER BY timestamp DESC, rowid DESC
  LIMIT ?
`);

function parseMetadata(raw: string | null): AuditMetadata | undefined {
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as AuditMetadata) : undefined;
  } catch {
    return undefined;
  }
}

function mapActivity(row: ActivityRow): AuditEvent {
  return {
    id: row.id,
    timestamp: row.timestamp,
    level: row.level,
    category: row.category,
    source: row.source,
    code: row.code,
    title: row.title,
    description: row.description,
    metadata: parseMetadata(row.metadata_json),
  };
}

export async function recordActivity(input: AuditInput): Promise<AuditEvent> {
  const event: AuditEvent = {
    ...input,
    source: input.source ?? "wago",
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    metadata: input.metadata ? redactLogFields(input.metadata) : undefined,
  };

  withTransaction(() => {
    insertActivity.run(
      event.id,
      event.timestamp,
      event.level,
      event.category,
      event.source,
      event.code,
      event.title,
      event.description,
      event.metadata ? JSON.stringify(event.metadata) : null,
    );
    pruneActivity.run(MAX_ACTIVITY_EVENTS);
  });

  return event;
}

export async function flushActivityStore(): Promise<void> {
  // SQLite commits writes synchronously on the shared connection.
}

export async function listActivity(limit = 100): Promise<AuditEvent[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 100, 1), MAX_ACTIVITY_EVENTS);
  return (selectActivity.all(safeLimit) as ActivityRow[]).map(mapActivity);
}

export async function resetActivityLogForTest(): Promise<void> {
  database.prepare("DELETE FROM activity_events").run();
}
