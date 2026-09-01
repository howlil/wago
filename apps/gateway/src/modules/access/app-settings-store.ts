import type { DatabaseSync } from "node:sqlite";

export type PersistedAppSettings = {
  appId: string;
  apiKeyHash: string | null;
  generatedAt: string | null;
};

type AppSettingsRow = {
  app_id?: string;
  api_key_hash?: string | null;
  generated_at?: string | null;
};

type AdminPasswordRow = {
  admin_password_hash?: string | null;
};

export function createAppSettingsStore(database: DatabaseSync) {
  const readStatement = database.prepare("SELECT app_id, api_key_hash, generated_at FROM app_settings WHERE id = 1");
  const writeStatement = database.prepare(`
    INSERT INTO app_settings (id, app_id, api_key_hash, generated_at)
    VALUES (1, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      app_id = excluded.app_id,
      api_key_hash = excluded.api_key_hash,
      generated_at = excluded.generated_at
  `);
  const readAdminPasswordStatement = database.prepare("SELECT admin_password_hash FROM app_settings WHERE id = 1");
  const writeAdminPasswordStatement = database.prepare("UPDATE app_settings SET admin_password_hash = ? WHERE id = 1");
  const clearStatement = database.prepare("DELETE FROM app_settings WHERE id = 1");

  function get(): PersistedAppSettings | null {
    const row = readStatement.get() as AppSettingsRow | undefined;
    if (!row?.app_id) return null;

    return {
      appId: row.app_id,
      apiKeyHash: row.api_key_hash ?? null,
      generatedAt: row.generated_at ?? null,
    };
  }

  function save(settings: PersistedAppSettings): void {
    writeStatement.run(settings.appId, settings.apiKeyHash, settings.generatedAt);
  }

  function getAdminPasswordHash(): string | null {
    const row = readAdminPasswordStatement.get() as AdminPasswordRow | undefined;
    return row?.admin_password_hash ?? null;
  }

  function setAdminPasswordHash(hash: string | null): void {
    writeAdminPasswordStatement.run(hash);
  }

  function clear(): void {
    clearStatement.run();
  }

  return { get, save, getAdminPasswordHash, setAdminPasswordHash, clear };
}
