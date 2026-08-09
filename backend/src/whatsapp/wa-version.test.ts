import { afterEach, describe, expect, it, vi } from "vitest";

const baileysMock = vi.hoisted(() => ({
  fetchLatestBaileysVersion: vi.fn(async () => ({ version: [2, 3000, 0] })),
}));

vi.mock("@whiskeysockets/baileys", () => ({
  fetchLatestBaileysVersion: baileysMock.fetchLatestBaileysVersion,
}));

describe("WA version strategy", () => {
  afterEach(async () => {
    vi.resetModules();
    baileysMock.fetchLatestBaileysVersion.mockClear();
  });

  it("fetches live version once per process", async () => {
    const { getLiveBaileysVersion } = await import("./wa-version.js");

    await expect(getLiveBaileysVersion()).resolves.toEqual([2, 3000, 0]);
    await expect(getLiveBaileysVersion()).resolves.toEqual([2, 3000, 0]);

    expect(baileysMock.fetchLatestBaileysVersion).toHaveBeenCalledTimes(1);
  });
});
