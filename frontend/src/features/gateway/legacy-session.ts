const legacyApiKeySessionStorageKey = "wago.apiKey";

export function clearLegacyApiKeySessionStorage(storage: Storage | undefined = globalThis.window?.sessionStorage) {
  storage?.removeItem(legacyApiKeySessionStorageKey);
}
