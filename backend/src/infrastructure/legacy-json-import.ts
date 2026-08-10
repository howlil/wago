import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";

const LEGACY_IMPORT_KEY = "legacy_json_import_v1";

function readLegacyPayload(path: string): unknown | null {
  if (!existsSync(path)) {
    return null;
  }

  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "version" in parsed && "data" in parsed) {
    return (parsed as { data: unknown }).data;
  }

  return parsed;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.map(finiteNumber).filter((item): item is number => item !== null) : [];
}

function importSettings(database: DatabaseSync, dataDirectory: string): void {
  if (database.prepare("SELECT 1 FROM app_settings WHERE id = 1").get()) {
    return;
  }

  const settings = asRecord(readLegacyPayload(resolve(dataDirectory, "app-settings.json")));
  if (!settings) {
    return;
  }

  const appId = optionalString(settings.appId);
  if (!appId) {
    return;
  }

  const rawApiKey = optionalString(settings.apiKey);
  const apiKeyHash =
    optionalString(settings.apiKeyHash) ?? (rawApiKey ? createHash("sha256").update(rawApiKey).digest("hex") : null);

  database
    .prepare(
      `INSERT INTO app_settings (id, app_id, api_key_hash, generated_at)
       VALUES (1, ?, ?, ?)`,
    )
    .run(appId, apiKeyHash, optionalString(settings.generatedAt));
}

function importBinding(database: DatabaseSync, dataDirectory: string): void {
  if (database.prepare("SELECT 1 FROM whatsapp_binding WHERE id = 1").get()) {
    return;
  }

  const binding = asRecord(readLegacyPayload(resolve(dataDirectory, "whatsapp-binding.json")));
  if (!binding || (binding.state !== "bound" && binding.state !== "unbound")) {
    return;
  }

  database
    .prepare(
      `INSERT INTO whatsapp_binding (id, state, jid, phone, bound_at)
       VALUES (1, ?, ?, ?, ?)`,
    )
    .run(binding.state, optionalString(binding.jid), optionalString(binding.phone), optionalString(binding.boundAt));
}

function importRecipients(database: DatabaseSync, dataDirectory: string): void {
  const existing = database.prepare("SELECT COUNT(*) AS count FROM recipients").get() as { count?: number } | undefined;
  if ((existing?.count ?? 0) > 0) {
    return;
  }

  const recipients = asRecord(readLegacyPayload(resolve(dataDirectory, "recipients.json")));
  if (!recipients) {
    return;
  }

  const insert = database.prepare(
    `INSERT OR REPLACE INTO recipients (
      jid, resolved_jid, label, allowed, opted_out, created_at, updated_at, last_successful_outbound_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const [jid, rawRecipient] of Object.entries(recipients)) {
    const recipient = asRecord(rawRecipient);
    if (!recipient || typeof recipient.jid !== "string") {
      continue;
    }

    const createdAt = optionalString(recipient.createdAt) ?? new Date(0).toISOString();
    const updatedAt = optionalString(recipient.updatedAt) ?? createdAt;

    insert.run(
      jid,
      optionalString(recipient.resolvedJid),
      optionalString(recipient.label),
      recipient.allowed === true ? 1 : 0,
      recipient.optedOut === true ? 1 : 0,
      createdAt,
      updatedAt,
      optionalString(recipient.lastSuccessfulOutboundAt),
    );
  }
}

function consumeTimestamp(counts: Map<number, number>, timestamp: number): boolean {
  const count = counts.get(timestamp) ?? 0;
  if (count <= 0) {
    return false;
  }

  if (count === 1) {
    counts.delete(timestamp);
  } else {
    counts.set(timestamp, count - 1);
  }
  return true;
}

function importOutboundPolicy(database: DatabaseSync, dataDirectory: string): void {
  const policy = asRecord(readLegacyPayload(resolve(dataDirectory, "outbound-policy.json")));
  if (!policy) {
    return;
  }

  const insertIdempotency = database.prepare(
    "INSERT OR IGNORE INTO idempotency_keys (key, expires_at) VALUES (?, ?)",
  );
  const idempotency = asRecord(policy.seenIdempotencyKeys);
  if (idempotency) {
    for (const [key, rawExpiresAt] of Object.entries(idempotency)) {
      const expiresAt = finiteNumber(rawExpiresAt);
      if (expiresAt !== null) {
        insertIdempotency.run(key, expiresAt);
      }
    }
  }

  const newChatCounts = new Map<number, number>();
  for (const timestamp of numberArray(policy.newChatTimestamps)) {
    newChatCounts.set(timestamp, (newChatCounts.get(timestamp) ?? 0) + 1);
  }

  const representedAccountEvents = new Map<number, number>();
  const insertOutboundEvent = database.prepare(
    "INSERT INTO outbound_events (recipient_jid, accepted_at, is_new_recipient) VALUES (?, ?, ?)",
  );
  const recipientTimestamps = asRecord(policy.recipientSendTimestamps);
  if (recipientTimestamps) {
    for (const [jid, rawTimestamps] of Object.entries(recipientTimestamps)) {
      for (const timestamp of numberArray(rawTimestamps)) {
        insertOutboundEvent.run(jid, timestamp, consumeTimestamp(newChatCounts, timestamp) ? 1 : 0);
        representedAccountEvents.set(timestamp, (representedAccountEvents.get(timestamp) ?? 0) + 1);
      }
    }
  }

  for (const timestamp of numberArray(policy.accountSendTimestamps)) {
    const represented = representedAccountEvents.get(timestamp) ?? 0;
    if (represented > 0) {
      representedAccountEvents.set(timestamp, represented - 1);
      continue;
    }

    insertOutboundEvent.run("legacy:unknown", timestamp, consumeTimestamp(newChatCounts, timestamp) ? 1 : 0);
  }

  const insertCooldown = database.prepare(
    `INSERT INTO recipient_reachout_cooldowns (jid, restricted_until)
     VALUES (?, ?)
     ON CONFLICT(jid) DO UPDATE SET restricted_until = excluded.restricted_until`,
  );
  const cooldowns = asRecord(policy.recipientReachoutCooldowns);
  if (cooldowns) {
    for (const [jid, rawRestrictedUntil] of Object.entries(cooldowns)) {
      const restrictedUntil = finiteNumber(rawRestrictedUntil);
      if (restrictedUntil !== null) {
        insertCooldown.run(jid, restrictedUntil);
      }
    }
  }

  database
    .prepare(
      `UPDATE gateway_policy_state
       SET outbound_paused = ?, outbound_pause_message = ?
       WHERE id = 1`,
    )
    .run(
      policy.outboundPaused === true ? 1 : 0,
      optionalString(policy.outboundPauseMessage) ?? "Outbound messaging is paused",
    );
}

function importActivity(database: DatabaseSync, dataDirectory: string): void {
  const existing = database.prepare("SELECT COUNT(*) AS count FROM activity_events").get() as
    | { count?: number }
    | undefined;
  if ((existing?.count ?? 0) > 0) {
    return;
  }

  const activity = readLegacyPayload(resolve(dataDirectory, "activity-log.json"));
  if (!Array.isArray(activity)) {
    return;
  }

  const insert = database.prepare(
    `INSERT OR IGNORE INTO activity_events (
      id, timestamp, level, category, code, title, description, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const rawEvent of activity.slice(0, 300)) {
    const event = asRecord(rawEvent);
    if (!event) {
      continue;
    }

    const id = optionalString(event.id);
    const timestamp = optionalString(event.timestamp);
    const level = optionalString(event.level);
    const category = optionalString(event.category);
    const code = optionalString(event.code);
    const title = optionalString(event.title);
    const description = optionalString(event.description);

    if (!id || !timestamp || !level || !category || !code || !title || !description) {
      continue;
    }

    insert.run(
      id,
      timestamp,
      level,
      category,
      code,
      title,
      description,
      event.metadata && typeof event.metadata === "object" ? JSON.stringify(event.metadata) : null,
    );
  }
}

export function importLegacyJsonState(database: DatabaseSync, dataDirectory: string): void {
  if (database.prepare("SELECT 1 FROM application_meta WHERE key = ?").get(LEGACY_IMPORT_KEY)) {
    return;
  }

  database.exec("BEGIN IMMEDIATE");

  try {
    importSettings(database, dataDirectory);
    importBinding(database, dataDirectory);
    importRecipients(database, dataDirectory);
    importOutboundPolicy(database, dataDirectory);
    importActivity(database, dataDirectory);

    database
      .prepare("INSERT OR REPLACE INTO application_meta (key, value) VALUES (?, ?)")
      .run(LEGACY_IMPORT_KEY, new Date().toISOString());
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
