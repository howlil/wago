import { afterEach, describe, expect, it, vi } from "vitest";

const baileysMock = vi.hoisted(() => ({
  fetchLatestWaWebVersion: vi.fn(async () => ({ version: [2, 3000, 0] })),
}));

vi.mock("@whiskeysockets/baileys", () => ({
  fetchLatestWaWebVersion: baileysMock.fetchLatestWaWebVersion,
}));

describe("WA version strategy", () => {
  afterEach(async () => {
    vi.resetModules();
    baileysMock.fetchLatestWaWebVersion.mockClear();
  });

  it("fetches the live WhatsApp Web version once per process", async () => {
    const { getLiveBaileysVersion } = await import("./wa-version.js");

    await expect(getLiveBaileysVersion()).resolves.toEqual([2, 3000, 0]);
    await expect(getLiveBaileysVersion()).resolves.toEqual([2, 3000, 0]);

    expect(baileysMock.fetchLatestWaWebVersion).toHaveBeenCalledTimes(1);
  });
});
