import { fetchLatestWaWebVersion, type WAVersion } from "@whiskeysockets/baileys";

let cachedLiveVersion: WAVersion | undefined;

export async function getLiveBaileysVersion(): Promise<WAVersion> {
  if (cachedLiveVersion) {
    return cachedLiveVersion;
  }

  const { version } = await fetchLatestWaWebVersion();
  cachedLiveVersion = version;

  return version;
}

export function resetLiveBaileysVersionForTest(): void {
  cachedLiveVersion = undefined;
}
