import { ApplicationError, isApplicationError } from "../errors/application-error.js";
import { getDatabase } from "../infrastructure/database.js";
import type { ActivityCategory, ActivityLevel, AuditEvent, AuditMetadata, AuditSource } from "./audit-event.js";

export type AuditQuery = {
  limit: number;
  before?: string;
  source?: AuditSource;
  category?: ActivityCategory;
  level?: ActivityLevel;
  q?: string;
};

export type AuditPage = {
  events: AuditEvent[];
  nextCursor?: string;
};

type AuditCursor = {
  timestamp: string;
  rowid: number;
};

type AuditRow = {
  rowid: number;
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

const MAX_PAGE_SIZE = 200;
const MAX_SEARCH_LENGTH = 100;
const database = getDatabase();

function invalidCursor(): ApplicationError {
  return new ApplicationError("INVALID_AUDIT_CURSOR", "Audit cursor is invalid");
}

function encodeCursor(cursor: AuditCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(raw: string): AuditCursor {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw invalidCursor();
    }

    const candidate = parsed as Record<string, unknown>;
    const timestamp = candidate.timestamp;
    const rowid = candidate.rowid;

    if (
      typeof timestamp !== "string" ||
      Number.isNaN(Date.parse(timestamp)) ||
      typeof rowid !== "number" ||
      !Number.isInteger(rowid) ||
      rowid <= 0
    ) {
      throw invalidCursor();
    }

    return { timestamp, rowid };
  } catch (error) {
    if (isApplicationError(error) && error.code === "INVALID_AUDIT_CURSOR") {
      throw error;
    }

    throw invalidCursor();
  }
}

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

function mapAuditRow(row: AuditRow): AuditEvent {
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

export async function listAudit(query: AuditQuery): Promise<AuditPage> {
  const safeLimit = Math.min(Math.max(Math.trunc(query.limit) || 100, 1), MAX_PAGE_SIZE);
  const cursor = query.before ? decodeCursor(query.before) : undefined;
  const search = query.q?.trim().slice(0, MAX_SEARCH_LENGTH) || undefined;
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (query.source) {
    conditions.push("source = ?");
    params.push(query.source);
  }

  if (query.category) {
    conditions.push("category = ?");
    params.push(query.category);
  }

  if (query.level) {
    conditions.push("level = ?");
    params.push(query.level);
  }

  if (cursor) {
    conditions.push("(timestamp < ? OR (timestamp = ? AND rowid < ?))");
    params.push(cursor.timestamp, cursor.timestamp, cursor.rowid);
  }

  if (search) {
    conditions.push("(code LIKE ? OR title LIKE ? OR description LIKE ?)");
    const pattern = `%${search}%`;
    params.push(pattern, pattern, pattern);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = database
    .prepare(`
      SELECT rowid, id, timestamp, level, category, source, code, title, description, metadata_json
      FROM activity_events
      ${where}
      ORDER BY timestamp DESC, rowid DESC
      LIMIT ?
    `)
    .all(...params, safeLimit + 1) as AuditRow[];

  const hasMore = rows.length > safeLimit;
  const pageRows = hasMore ? rows.slice(0, safeLimit) : rows;
  const lastRow = pageRows.at(-1);

  return {
    events: pageRows.map(mapAuditRow),
    nextCursor:
      hasMore && lastRow
        ? encodeCursor({
            timestamp: lastRow.timestamp,
            rowid: lastRow.rowid,
          })
        : undefined,
  };
}
