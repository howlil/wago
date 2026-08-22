import type { DatabaseSync } from "node:sqlite";

export type PersistedAppSettings = {
  appId: string;
  apiKeyHash: string | null;
  generatedAt: string | null;
  setupCodeHash: string | null;
  setupCodeGeneratedAt: string | null;
};

type AppSettingsRow = {
  app_id?: string;
  api_key_hash?: string | null;
  generated_at?: string | null;
  setup_code_hash?: string | null;
  setup_code_generated_at?: string | null;
};

export function createAppSettingsStore(database: DatabaseSync) {
  const readStatement = database.prepare(
    "SELECT app_id, api_key_hash, generated_at, setup_code_hash, setup_code_generated_at FROM app_settings WHERE id = 1",
  );
  const writeStatement = database.prepare(`
    INSERT INTO app_settings (
      id,
      app_id,
      api_key_hash,
      generated_at,
      setup_code_hash,
      setup_code_generated_at
    )
    VALUES (1, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      app_id = excluded.app_id,
      api_key_hash = excluded.api_key_hash,
      generated_at = excluded.generated_at,
      setup_code_hash = excluded.setup_code_hash,
      setup_code_generated_at = excluded.setup_code_generated_at
  `);
  const clearStatement = database.prepare("DELETE FROM app_settings WHERE id = 1");

  function get(): PersistedAppSettings | null {
    const row = readStatement.get() as AppSettingsRow | undefined;
    if (!row?.app_id) return null;

    return {
      appId: row.app_id,
      apiKeyHash: row.api_key_hash ?? null,
      generatedAt: row.generated_at ?? null,
      setupCodeHash: row.setup_code_hash ?? null,
      setupCodeGeneratedAt: row.setup_code_generated_at ?? null,
    };
  }

  function save(settings: PersistedAppSettings): void {
    writeStatement.run(
      settings.appId,
      settings.apiKeyHash,
      settings.generatedAt,
      settings.setupCodeHash,
      settings.setupCodeGeneratedAt,
    );
  }

  function clear(): void {
    clearStatement.run();
  }

  return { get, save, clear };
}
