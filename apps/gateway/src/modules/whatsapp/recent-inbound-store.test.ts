import type { WAMessage } from "@whiskeysockets/baileys";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getRecentInboundMessage,
  getRecentInboundQuote,
  rememberRecentInboundMessage,
  resetRecentInboundStoreForTest,
} from "./recent-inbound-store.js";

describe("recent inbound message store", () => {
  afterEach(() => {
    vi.useRealTimers();
    resetRecentInboundStoreForTest();
  });

  it("returns a quote only for the same logical recipient", () => {
    const message = {
      key: { id: "provider-inbound", remoteJid: "6281234567890@s.whatsapp.net", fromMe: false },
      message: { conversation: "hello" },
    } as WAMessage;

    rememberRecentInboundMessage("in_1", "6281234567890", message);

    expect(getRecentInboundQuote("in_1", "6281234567890")).toBe(message);
    expect(getRecentInboundQuote("in_1", "6280000000000")).toBeNull();
    expect(getRecentInboundMessage("in_1")).toBe(message);
  });

  it("expires bounded reply context", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T00:00:00.000Z"));
    const message = {
      key: { id: "provider-inbound", remoteJid: "6281234567890@s.whatsapp.net", fromMe: false },
      message: { conversation: "hello" },
    } as WAMessage;

    rememberRecentInboundMessage("in_expiring", "6281234567890", message);
    vi.advanceTimersByTime(60 * 60 * 1_000 + 1);

    expect(getRecentInboundMessage("in_expiring")).toBeNull();
  });
});
