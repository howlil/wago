import { randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

const MIN_SECRET_LENGTH = 32;

type WebhookSettingsRow = {
  enabled: number;
  url: string | null;
  secret: string | null;
  previous_secret: string | null;
  created_at: string;
  updated_at: string;
};

export type WebhookSettings = {
  enabled: boolean;
  url: string | null;
  secret: string | null;
  previousSecret: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LegacyWebhookSettings = {
  enabled: boolean;
  url: string | null;
  secret: string | null;
  previousSecret: string | null;
};

export type SaveWebhookSettingsResult = {
  settings: WebhookSettings;
  generatedSecret?: string;
};

function generateSecret(): string {
  return randomBytes(32).toString("base64url");
}

function normalizeUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Webhook URL must be a valid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Webhook URL must use http or https");
  }

  if (parsed.username || parsed.password) {
    throw new Error("Webhook URL must not contain embedded credentials");
  }

  return parsed.toString();
}

function validateSecret(secret: string | null, name = "Webhook secret"): void {
  if (secret && secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`${name} must contain at least ${MIN_SECRET_LENGTH} characters`);
  }
}

function mapRow(row: WebhookSettingsRow): WebhookSettings {
  return {
    enabled: row.enabled === 1,
    url: row.url,
    secret: row.secret,
    previousSecret: row.previous_secret,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createWebhookSettingsStore(database: DatabaseSync) {
  const readStatement = database.prepare(`
    SELECT enabled, url, secret, previous_secret, created_at, updated_at
    FROM webhook_settings
    WHERE id = 1
  `);
  const writeStatement = database.prepare(`
    INSERT INTO webhook_settings (id, enabled, url, secret, previous_secret, created_at, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      enabled = excluded.enabled,
      url = excluded.url,
      secret = excluded.secret,
      previous_secret = excluded.previous_secret,
      updated_at = excluded.updated_at
  `);
  const clearStatement = database.prepare("DELETE FROM webhook_settings WHERE id = 1");

  function get(): WebhookSettings | null {
    const row = readStatement.get() as WebhookSettingsRow | undefined;
    return row ? mapRow(row) : null;
  }

  function write(settings: WebhookSettings): WebhookSettings {
    writeStatement.run(
      settings.enabled ? 1 : 0,
      settings.url,
      settings.secret,
      settings.previousSecret,
      settings.createdAt,
      settings.updatedAt,
    );
    return get() as WebhookSettings;
  }

  function importLegacyIfEmpty(legacy: LegacyWebhookSettings): WebhookSettings | null {
    const current = get();
    if (current) {
      return current;
    }

    if (!legacy.enabled) {
      return null;
    }

    const url = normalizeUrl(legacy.url);
    if (!url || !legacy.secret) {
      throw new Error("Webhook URL and secret are required when webhook delivery is enabled");
    }
    validateSecret(legacy.secret);
    validateSecret(legacy.previousSecret, "Previous webhook secret");

    const now = new Date().toISOString();
    return write({
      enabled: true,
      url,
      secret: legacy.secret,
      previousSecret: legacy.previousSecret,
      createdAt: now,
      updatedAt: now,
    });
  }

  function save(input: { enabled: boolean; url?: string | null }): SaveWebhookSettingsResult {
    const current = get();
    const url = input.url === undefined ? (current?.url ?? null) : normalizeUrl(input.url);
    if (input.enabled && !url) {
      throw new Error("Webhook URL is required when webhook delivery is enabled");
    }

    const now = new Date().toISOString();
    const generatedSecret = input.enabled && !current?.secret ? generateSecret() : undefined;
    const settings = write({
      enabled: input.enabled,
      url,
      secret: current?.secret ?? generatedSecret ?? null,
      previousSecret: current?.previousSecret ?? null,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    });

    return generatedSecret ? { settings, generatedSecret } : { settings };
  }

  function rotateSecret(): SaveWebhookSettingsResult {
    const current = get();
    if (!current?.secret) {
      throw new Error("Webhook signing secret is not configured");
    }

    const generatedSecret = generateSecret();
    const settings = write({
      ...current,
      secret: generatedSecret,
      previousSecret: current.secret,
      updatedAt: new Date().toISOString(),
    });
    return { settings, generatedSecret };
  }

  function completeRotation(): WebhookSettings {
    const current = get();
    if (!current) {
      throw new Error("Webhook settings are not configured");
    }

    return write({
      ...current,
      previousSecret: null,
      updatedAt: new Date().toISOString(),
    });
  }

  function clear(): void {
    clearStatement.run();
  }

  return {
    get,
    save,
    rotateSecret,
    completeRotation,
    importLegacyIfEmpty,
    clear,
  };
}
