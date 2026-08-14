import { getDatabase, withTransaction } from "../infrastructure/database.js";

export type PolicyWindow = {
  count: number;
  oldest: number | null;
};

export type OutboundPauseState = {
  paused: boolean;
  message: string;
};

export type AcceptedOutboundRecord = {
  jid: string;
  acceptedAt: number;
  isNewRecipient: boolean;
  idempotencyKey?: string;
  idempotencyExpiresAt?: number;
};

const database = getDatabase();
const selectPause = database.prepare(
  "SELECT outbound_paused, outbound_pause_message FROM gateway_policy_state WHERE id = 1",
);
const updatePause = database.prepare(`
  UPDATE gateway_policy_state
  SET outbound_paused = ?, outbound_pause_message = ?
  WHERE id = 1
`);
const selectIdempotency = database.prepare("SELECT expires_at FROM idempotency_keys WHERE key = ?");
const upsertIdempotency = database.prepare(`
  INSERT INTO idempotency_keys (key, expires_at)
  VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET expires_at = excluded.expires_at
`);
const deleteIdempotency = database.prepare("DELETE FROM idempotency_keys WHERE key = ?");
const pruneIdempotency = database.prepare("DELETE FROM idempotency_keys WHERE expires_at <= ?");
const selectCooldown = database.prepare("SELECT restricted_until FROM recipient_reachout_cooldowns WHERE jid = ?");
const upsertCooldown = database.prepare(`
  INSERT INTO recipient_reachout_cooldowns (jid, restricted_until)
  VALUES (?, ?)
  ON CONFLICT(jid) DO UPDATE SET restricted_until = excluded.restricted_until
`);
const deleteCooldown = database.prepare("DELETE FROM recipient_reachout_cooldowns WHERE jid = ?");
const pruneCooldowns = database.prepare("DELETE FROM recipient_reachout_cooldowns WHERE restricted_until <= ?");
const insertOutboundEvent = database.prepare(`
  INSERT INTO outbound_events (recipient_jid, accepted_at, is_new_recipient)
  VALUES (?, ?, ?)
`);
const pruneOutboundEvents = database.prepare("DELETE FROM outbound_events WHERE accepted_at < ?");
const selectAccountWindow = database.prepare(`
  SELECT COUNT(*) AS count, MIN(accepted_at) AS oldest
  FROM outbound_events
  WHERE accepted_at >= ?
`);
const selectRecipientWindow = database.prepare(`
  SELECT COUNT(*) AS count, MIN(accepted_at) AS oldest
  FROM outbound_events
  WHERE recipient_jid = ? AND accepted_at >= ?
`);
const selectNewChatWindow = database.prepare(`
  SELECT COUNT(*) AS count, MIN(accepted_at) AS oldest
  FROM outbound_events
  WHERE is_new_recipient = 1 AND accepted_at >= ?
`);

function mapWindow(row: unknown): PolicyWindow {
  const value = row as { count?: number; oldest?: number | null } | undefined;
  return {
    count: value?.count ?? 0,
    oldest: value?.oldest ?? null,
  };
}

export function getOutboundPauseState(): OutboundPauseState {
  const row = selectPause.get() as { outbound_paused?: number; outbound_pause_message?: string } | undefined;

  return {
    paused: row?.outbound_paused === 1,
    message: row?.outbound_pause_message || "Outbound messaging is paused",
  };
}

export function isIdempotencyKeyActive(key: string, now: number): boolean {
  const row = selectIdempotency.get(key) as { expires_at?: number } | undefined;
  const expiresAt = row?.expires_at;

  if (!expiresAt) {
    return false;
  }

  if (expiresAt <= now) {
    deleteIdempotency.run(key);
    return false;
  }

  return true;
}

export function getRecipientReachoutCooldown(jid: string, now: number): number | null {
  const row = selectCooldown.get(jid) as { restricted_until?: number } | undefined;
  const restrictedUntil = row?.restricted_until;

  if (!restrictedUntil) {
    return null;
  }

  if (restrictedUntil <= now) {
    deleteCooldown.run(jid);
    return null;
  }

  return restrictedUntil;
}

export function getAccountWindow(since: number): PolicyWindow {
  return mapWindow(selectAccountWindow.get(since));
}

export function getRecipientWindow(jid: string, since: number): PolicyWindow {
  return mapWindow(selectRecipientWindow.get(jid, since));
}

export function getNewChatWindow(since: number): PolicyWindow {
  return mapWindow(selectNewChatWindow.get(since));
}

export function recordAcceptedOutbound(record: AcceptedOutboundRecord): void {
  insertOutboundEvent.run(record.jid, record.acceptedAt, record.isNewRecipient ? 1 : 0);

  if (record.idempotencyKey && record.idempotencyExpiresAt) {
    upsertIdempotency.run(record.idempotencyKey, record.idempotencyExpiresAt);
  }
}

export function pruneOutboundSafety(now: number, historyBefore: number): void {
  pruneIdempotency.run(now);
  pruneCooldowns.run(now);
  pruneOutboundEvents.run(historyBefore);
}

export function setRecipientReachoutCooldown(jid: string, restrictedUntil: number): void {
  upsertCooldown.run(jid, restrictedUntil);
}

export function setOutboundPause(paused: boolean, message = "Outbound messaging is paused"): void {
  updatePause.run(paused ? 1 : 0, message);
}

export function resetOutboundPolicyStoreForTest(): Promise<void> {
  withTransaction(() => {
    database.prepare("DELETE FROM idempotency_keys").run();
    database.prepare("DELETE FROM outbound_events").run();
    database.prepare("DELETE FROM recipient_reachout_cooldowns").run();
    setOutboundPause(false);
  });
  return Promise.resolve();
}
