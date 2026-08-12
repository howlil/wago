import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getDatabase } from "../infrastructure/database.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const database = getDatabase();

const insertSessionStatement = database.prepare(`
  INSERT INTO browser_sessions (
    id,
    token_hash,
    created_at,
    last_seen_at,
    expires_at,
    revoked_at
  ) VALUES (?, ?, ?, ?, ?, NULL)
`);

const readSessionStatement = database.prepare(`
  SELECT id, expires_at, revoked_at
  FROM browser_sessions
  WHERE token_hash = ?
`);

const touchSessionStatement = database.prepare(`
  UPDATE browser_sessions
  SET last_seen_at = ?
  WHERE id = ?
`);

const revokeSessionStatement = database.prepare(`
  UPDATE browser_sessions
  SET revoked_at = ?
  WHERE token_hash = ? AND revoked_at IS NULL
`);

const deleteExpiredSessionsStatement = database.prepare(`
  DELETE FROM browser_sessions
  WHERE expires_at <= ? OR revoked_at IS NOT NULL
`);

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type BrowserSession = {
  token: string;
  expiresAt: number;
};

export function createBrowserSession(now = Date.now()): BrowserSession {
  deleteExpiredSessionsStatement.run(now);

  const token = `ws_${randomBytes(32).toString("base64url")}`;
  const expiresAt = now + SESSION_TTL_MS;

  insertSessionStatement.run(randomUUID(), hashSessionToken(token), now, now, expiresAt);

  return { token, expiresAt };
}

export function isBrowserSessionValid(token: string, now = Date.now()): boolean {
  if (!token) {
    return false;
  }

  const row = readSessionStatement.get(hashSessionToken(token)) as
    | { id: string; expires_at: number; revoked_at: number | null }
    | undefined;

  if (!row || row.revoked_at !== null || row.expires_at <= now) {
    return false;
  }

  touchSessionStatement.run(now, row.id);
  return true;
}

export function revokeBrowserSession(token: string, now = Date.now()): boolean {
  if (!token) {
    return false;
  }

  const result = revokeSessionStatement.run(now, hashSessionToken(token));
  return result.changes > 0;
}

export function resetBrowserSessionsForTest(): void {
  database.prepare("DELETE FROM browser_sessions").run();
}
