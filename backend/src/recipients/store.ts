import { getDatabase, withTransaction } from "../infrastructure/database.js";
import { toWhatsAppJid } from "../utils/phone.js";

export type RecipientRecord = {
  jid: string;
  resolvedJid?: string;
  label?: string;
  allowed: boolean;
  optedOut: boolean;
  createdAt: string;
  updatedAt: string;
  lastSuccessfulOutboundAt?: string;
};

type RecipientRow = {
  jid: string;
  resolved_jid: string | null;
  label: string | null;
  allowed: number;
  opted_out: number;
  created_at: string;
  updated_at: string;
  last_successful_outbound_at: string | null;
};

const database = getDatabase();
const selectRecipient = database.prepare(`
  SELECT jid, resolved_jid, label, allowed, opted_out, created_at, updated_at, last_successful_outbound_at
  FROM recipients WHERE jid = ?
`);
const selectRecipients = database.prepare(`
  SELECT jid, resolved_jid, label, allowed, opted_out, created_at, updated_at, last_successful_outbound_at
  FROM recipients ORDER BY jid ASC
`);
const upsertRecipient = database.prepare(`
  INSERT INTO recipients (
    jid, resolved_jid, label, allowed, opted_out, created_at, updated_at, last_successful_outbound_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(jid) DO UPDATE SET
    resolved_jid = excluded.resolved_jid,
    label = excluded.label,
    allowed = excluded.allowed,
    opted_out = excluded.opted_out,
    updated_at = excluded.updated_at,
    last_successful_outbound_at = excluded.last_successful_outbound_at
`);
const updateResolution = database.prepare("UPDATE recipients SET resolved_jid = ?, updated_at = ? WHERE jid = ?");
const updateSuccessfulOutbound = database.prepare(`
  UPDATE recipients
  SET resolved_jid = COALESCE(?, resolved_jid),
      last_successful_outbound_at = ?,
      updated_at = ?
  WHERE jid = ?
`);

function nowIso(): string {
  return new Date().toISOString();
}

function mapRecipient(row: RecipientRow): RecipientRecord {
  return {
    jid: row.jid,
    resolvedJid: row.resolved_jid ?? undefined,
    label: row.label ?? undefined,
    allowed: row.allowed === 1,
    optedOut: row.opted_out === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSuccessfulOutboundAt: row.last_successful_outbound_at ?? undefined,
  };
}

function getRecipientRow(jid: string): RecipientRow | undefined {
  return selectRecipient.get(jid) as RecipientRow | undefined;
}

export async function flushRecipientStore(): Promise<void> {
  // SQLite commits writes synchronously on the shared connection.
}

export async function listRecipients(): Promise<RecipientRecord[]> {
  return (selectRecipients.all() as RecipientRow[]).map(mapRecipient);
}

export async function getRecipientByJid(jid: string): Promise<RecipientRecord | null> {
  const row = getRecipientRow(jid);
  return row ? mapRecipient(row) : null;
}

export async function allowRecipient(phone: string, label?: string): Promise<RecipientRecord> {
  return allowRecipientJid(toWhatsAppJid(phone), label);
}

export async function allowRecipientJid(jid: string, label?: string): Promise<RecipientRecord> {
  return withTransaction(() => {
    const existing = getRecipientRow(jid);
    const timestamp = nowIso();
    const record: RecipientRecord = {
      jid,
      resolvedJid: existing?.resolved_jid ?? undefined,
      label: label?.trim() || existing?.label || undefined,
      allowed: true,
      optedOut: false,
      createdAt: existing?.created_at ?? timestamp,
      updatedAt: timestamp,
      lastSuccessfulOutboundAt: existing?.last_successful_outbound_at ?? undefined,
    };

    upsertRecipient.run(
      record.jid,
      record.resolvedJid ?? null,
      record.label ?? null,
      1,
      0,
      record.createdAt,
      record.updatedAt,
      record.lastSuccessfulOutboundAt ?? null,
    );
    return record;
  });
}

export async function optOutRecipient(phone: string): Promise<RecipientRecord> {
  const jid = toWhatsAppJid(phone);

  return withTransaction(() => {
    const existing = getRecipientRow(jid);
    const timestamp = nowIso();
    const record: RecipientRecord = {
      jid,
      resolvedJid: existing?.resolved_jid ?? undefined,
      label: existing?.label ?? undefined,
      allowed: existing?.allowed === 1,
      optedOut: true,
      createdAt: existing?.created_at ?? timestamp,
      updatedAt: timestamp,
      lastSuccessfulOutboundAt: existing?.last_successful_outbound_at ?? undefined,
    };

    upsertRecipient.run(
      record.jid,
      record.resolvedJid ?? null,
      record.label ?? null,
      record.allowed ? 1 : 0,
      1,
      record.createdAt,
      record.updatedAt,
      record.lastSuccessfulOutboundAt ?? null,
    );
    return record;
  });
}

export async function rememberRecipientResolution(jid: string, resolvedJid: string): Promise<void> {
  updateResolution.run(resolvedJid, nowIso(), jid);
}

export function rememberSuccessfulOutboundSync(jid: string, resolvedJid?: string): void {
  const timestamp = nowIso();
  updateSuccessfulOutbound.run(resolvedJid ?? null, timestamp, timestamp, jid);
}

export async function rememberSuccessfulOutbound(jid: string, resolvedJid?: string): Promise<void> {
  rememberSuccessfulOutboundSync(jid, resolvedJid);
}

export async function resetRecipientStoreForTest(): Promise<void> {
  database.prepare("DELETE FROM recipients").run();
}
