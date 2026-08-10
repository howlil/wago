import { randomUUID } from "node:crypto";
import { getDatabase, withTransaction } from "../infrastructure/database.js";
import { redactLogFields } from "../infrastructure/logger.js";

export type ActivityLevel = "info" | "success" | "warning" | "error";
export type ActivityCategory = "system" | "security" | "connection" | "recipient" | "messaging";

export type ActivityMetadata = Record<string, string | number | boolean | null | undefined>;

export type ActivityEvent = {
  id: string;
  timestamp: string;
  level: ActivityLevel;
  category: ActivityCategory;
  code: string;
  title: string;
  description: string;
  metadata?: ActivityMetadata;
};

export type ActivityInput = Omit<ActivityEvent, "id" | "timestamp">;

type ActivityRow = {
  id: string;
  timestamp: string;
  level: ActivityLevel;
  category: ActivityCategory;
  code: string;
  title: string;
  description: string;
  metadata_json: string | null;
};

const MAX_ACTIVITY_EVENTS = 300;
const database = getDatabase();
const insertActivity = database.prepare(`
  INSERT INTO activity_events (
    id, timestamp, level, category, code, title, description, metadata_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
  SELECT id, timestamp, level, category, code, title, description, metadata_json
  FROM activity_events
  ORDER BY timestamp DESC, rowid DESC
  LIMIT ?
`);

function parseMetadata(raw: string | null): ActivityMetadata | undefined {
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as ActivityMetadata) : undefined;
  } catch {
    return undefined;
  }
}

function mapActivity(row: ActivityRow): ActivityEvent {
  return {
    id: row.id,
    timestamp: row.timestamp,
    level: row.level,
    category: row.category,
    code: row.code,
    title: row.title,
    description: row.description,
    metadata: parseMetadata(row.metadata_json),
  };
}

export async function recordActivity(input: ActivityInput): Promise<ActivityEvent> {
  const event: ActivityEvent = {
    ...input,
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

export async function listActivity(limit = 100): Promise<ActivityEvent[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 100, 1), MAX_ACTIVITY_EVENTS);
  return (selectActivity.all(safeLimit) as ActivityRow[]).map(mapActivity);
}

export async function resetActivityLogForTest(): Promise<void> {
  database.prepare("DELETE FROM activity_events").run();
}
