import { beforeEach, describe, expect, it, vi } from "vitest";

const fsMock = vi.hoisted(() => ({ existsSync: vi.fn() }));
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

vi.mock("node:fs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs")>()),
  existsSync: fsMock.existsSync,
}));

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
    fsMock.existsSync.mockReset();
    fsMock.existsSync.mockReturnValue(false);
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

  it("keeps the control plane startup alive when persisted auth cannot be resumed", async () => {
    fsMock.existsSync.mockReturnValue(true);
    baileysMock.useMultiFileAuthState.mockRejectedValue(new SyntaxError("corrupt auth state"));

    const { getWhatsAppStatus, resumeWhatsAppSession } = await import("./lifecycle.js");

    await expect(resumeWhatsAppSession()).resolves.toBeUndefined();
    expect(getWhatsAppStatus().status).toBe("disconnected");
    expect(baileysMock.makeWASocket).not.toHaveBeenCalled();
  });

  it("marks credential persistence degraded and recovers after the next successful save", async () => {
    baileysMock.saveCreds.mockRejectedValueOnce(new Error("disk write failed")).mockResolvedValueOnce(undefined);
    baileysMock.useMultiFileAuthState.mockResolvedValue({ state: {}, saveCreds: baileysMock.saveCreds });

    const { initializeWhatsApp } = await import("./lifecycle.js");
    const { getCredentialPersistenceHealth } = await import("../../whatsapp/credential-persistence-health.js");
    await initializeWhatsApp();

    baileysMock.ev.emit("creds.update");
    await vi.waitFor(() => expect(getCredentialPersistenceHealth().status).toBe("degraded"));

    baileysMock.ev.emit("creds.update");
    await vi.waitFor(() => expect(getCredentialPersistenceHealth().status).toBe("healthy"));
    expect(getCredentialPersistenceHealth().consecutiveFailures).toBe(0);
  });
});
