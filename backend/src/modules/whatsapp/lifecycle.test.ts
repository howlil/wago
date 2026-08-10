import { beforeEach, describe, expect, it, vi } from "vitest";

const baileysMock = vi.hoisted(() => {
  type Handler = (...args: unknown[]) => void;
  const handlers = new Map<string, Set<Handler>>();
  const ev = {
    emit(event: string, ...args: unknown[]): void {
      for (const handler of handlers.get(event) ?? []) handler(...args);
    },
    on(event: string, handler: Handler): void {
      const existing = handlers.get(event) ?? new Set<Handler>();
      existing.add(handler);
      handlers.set(event, existing);
    },
    removeAllListeners(): void {
      handlers.clear();
    },
  };

  return {
    ev,
    makeWASocket: vi.fn(),
    saveCreds: vi.fn(),
    useMultiFileAuthState: vi.fn(),
    fetchAccountReachoutTimelock: vi.fn(),
    fetchNewChatMessageCap: vi.fn(),
    end: vi.fn(),
    logout: vi.fn(),
  };
});

vi.mock("@whiskeysockets/baileys", () => ({
  default: baileysMock.makeWASocket,
  useMultiFileAuthState: baileysMock.useMultiFileAuthState,
  WAMessageStatus: { ERROR: 0, SERVER_ACK: 1 },
  DisconnectReason: {
    connectionClosed: 428,
    connectionLost: 408,
    connectionReplaced: 440,
    timedOut: 408,
    loggedOut: 401,
    badSession: 500,
    restartRequired: 515,
    multideviceMismatch: 411,
    forbidden: 403,
    unavailableService: 503,
  },
}));

describe("WhatsApp lifecycle", () => {
  beforeEach(() => {
    vi.resetModules();
    baileysMock.ev.removeAllListeners();
    baileysMock.makeWASocket.mockReset();
    baileysMock.saveCreds.mockReset();
    baileysMock.useMultiFileAuthState.mockReset();
    baileysMock.fetchAccountReachoutTimelock.mockReset();
    baileysMock.fetchNewChatMessageCap.mockReset();
    baileysMock.end.mockReset();
    baileysMock.logout.mockReset();

    baileysMock.fetchAccountReachoutTimelock.mockResolvedValue(undefined);
    baileysMock.fetchNewChatMessageCap.mockResolvedValue(undefined);
    baileysMock.makeWASocket.mockReturnValue({
      ev: baileysMock.ev,
      fetchAccountReachoutTimelock: baileysMock.fetchAccountReachoutTimelock,
      fetchNewChatMessageCap: baileysMock.fetchNewChatMessageCap,
      end: baileysMock.end,
      logout: baileysMock.logout,
    });
  });

  it("suppresses duplicate concurrent initialization", async () => {
    let release!: () => void;
    baileysMock.useMultiFileAuthState.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ state: {}, saveCreds: baileysMock.saveCreds });
        }),
    );

    const { initializeWhatsApp } = await import("./lifecycle.js");
    const first = initializeWhatsApp();
    const second = initializeWhatsApp();

    expect(baileysMock.makeWASocket).not.toHaveBeenCalled();
    release();
    await Promise.all([first, second]);

    expect(baileysMock.makeWASocket).toHaveBeenCalledTimes(1);
  });

  it("ignores stale socket events after its generation is invalidated", async () => {
    vi.useFakeTimers();
    baileysMock.useMultiFileAuthState.mockResolvedValue({ state: {}, saveCreds: baileysMock.saveCreds });

    const { getWhatsAppStatus, initializeWhatsApp } = await import("./lifecycle.js");
    await initializeWhatsApp();

    baileysMock.ev.emit("connection.update", {
      connection: "close",
      lastDisconnect: { error: { output: { statusCode: 428 } } },
    });
    expect(getWhatsAppStatus().status).toBe("disconnected");

    baileysMock.ev.emit("connection.update", { connection: "open" });
    expect(getWhatsAppStatus().status).toBe("disconnected");

    vi.useRealTimers();
  });
});
