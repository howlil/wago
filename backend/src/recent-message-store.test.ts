import { afterEach, describe, expect, it, vi } from "vitest";
import { getRecentMessage, rememberRecentTextMessage, resetRecentMessageStoreForTest } from "./recent-message-store.js";

describe("recent message store", () => {
  afterEach(() => {
    vi.useRealTimers();
    resetRecentMessageStoreForTest();
  });

  it("returns a remembered text message by id and remote JID", async () => {
    rememberRecentTextMessage(
      {
        id: "message-1",
        remoteJid: "6281234567890@s.whatsapp.net"
      },
      "Hello"
    );

    await expect(
      getRecentMessage({
        id: "message-1",
        remoteJid: "6281234567890@s.whatsapp.net"
      })
    ).resolves.toEqual({
      conversation: "Hello"
    });
  });

  it("does not return expired messages", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T00:00:00.000Z"));

    rememberRecentTextMessage(
      {
        id: "message-1",
        remoteJid: "6281234567890@s.whatsapp.net"
      },
      "Hello"
    );

    vi.setSystemTime(new Date("2026-08-09T01:00:01.000Z"));

    await expect(
      getRecentMessage({
        id: "message-1",
        remoteJid: "6281234567890@s.whatsapp.net"
      })
    ).resolves.toBeUndefined();
  });
});
