import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fsMock = vi.hoisted(() => ({
  existsSync: vi.fn(),
  mkdir: vi.fn(),
  rm: vi.fn(),
}));

const baileysMock = vi.hoisted(() => {
  type Handler = (...args: unknown[]) => void;
  const handlers = new Map<string, Set<Handler>>();
  const ev = {
    emit(event: string, ...args: unknown[]): void {
      for (const handler of handlers.get(event) ?? []) {
        handler(...args);
      }
    },
    on(event: string, handler: Handler): void {
      let eventHandlers = handlers.get(event);

      if (!eventHandlers) {
        eventHandlers = new Set();
        handlers.set(event, eventHandlers);
      }

      eventHandlers.add(handler);
    },
    removeAllListeners(): void {
      handlers.clear();
    },
  };

  return {
    ev,
    makeWASocket: vi.fn(),
    saveCreds: vi.fn(),
    logout: vi.fn(),
    end: vi.fn(),
    fetchAccountReachoutTimelock: vi.fn(),
    fetchNewChatMessageCap: vi.fn(),
    useMultiFileAuthState: vi.fn(),
  };
});

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    existsSync: fsMock.existsSync,
  };
});

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    mkdir: fsMock.mkdir,
    rm: fsMock.rm,
  };
});

vi.mock("@whiskeysockets/baileys", () => ({
  default: baileysMock.makeWASocket,
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
  useMultiFileAuthState: baileysMock.useMultiFileAuthState,
  WAMessageStatus: {
    ERROR: 0,
    SERVER_ACK: 1,
  },
}));

describe("WhatsApp lifecycle contracts", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    baileysMock.ev.removeAllListeners();

    fsMock.existsSync.mockReset();
    fsMock.mkdir.mockReset();
    fsMock.rm.mockReset();
    baileysMock.makeWASocket.mockReset();
    baileysMock.saveCreds.mockReset();
    baileysMock.logout.mockReset();
    baileysMock.end.mockReset();
    baileysMock.fetchAccountReachoutTimelock.mockReset();
    baileysMock.fetchNewChatMessageCap.mockReset();
    baileysMock.useMultiFileAuthState.mockReset();

    fsMock.existsSync.mockReturnValue(false);
    fsMock.mkdir.mockResolvedValue(undefined);
    fsMock.rm.mockResolvedValue(undefined);
    baileysMock.logout.mockResolvedValue(undefined);
    baileysMock.fetchAccountReachoutTimelock.mockResolvedValue(undefined);
    baileysMock.fetchNewChatMessageCap.mockResolvedValue(undefined);
    baileysMock.useMultiFileAuthState.mockResolvedValue({
      state: {},
      saveCreds: baileysMock.saveCreds,
    });
    baileysMock.makeWASocket.mockReturnValue({
      ev: baileysMock.ev,
      user: { id: "6281234567890@s.whatsapp.net" },
      logout: baileysMock.logout,
      end: baileysMock.end,
      fetchAccountReachoutTimelock: baileysMock.fetchAccountReachoutTimelock,
      fetchNewChatMessageCap: baileysMock.fetchNewChatMessageCap,
      onWhatsApp: vi.fn(),
      sendMessage: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats first boot without credentials as an unbound invalid session without opening a socket", async () => {
    const { getWhatsAppStatus, resumeWhatsAppSession } = await import("../whatsapp.js");
    const { bindWhatsAppAccount, clearWhatsAppBinding } = await import("./binding-store.js");
    const { refreshAccountHealth } = await import("./account-health.js");

    clearWhatsAppBinding();
    bindWhatsAppAccount("6281234567890@s.whatsapp.net");
    await refreshAccountHealth(
      {
        fetchAccountReachoutTimelock: async () => ({ isActive: false }),
        fetchNewChatMessageCap: async () => ({ capping_status: "NONE" }),
      },
      { force: true },
    );

    fsMock.existsSync.mockReturnValue(false);
    await resumeWhatsAppSession();

    expect(baileysMock.makeWASocket).not.toHaveBeenCalled();
    expect(getWhatsAppStatus()).toMatchObject({
      status: "disconnected",
      binding: { state: "unbound" },
      accountHealth: {
        availability: "unavailable",
        unavailableReason: "session_invalid",
      },
    });
  });

  it("resumes an existing credential set by starting exactly one socket", async () => {
    const { getWhatsAppStatus, resumeWhatsAppSession } = await import("../whatsapp.js");
    const { clearWhatsAppBinding } = await import("./binding-store.js");

    clearWhatsAppBinding();
    fsMock.existsSync.mockReturnValue(true);

    await resumeWhatsAppSession();

    expect(baileysMock.useMultiFileAuthState).toHaveBeenCalledTimes(1);
    expect(baileysMock.makeWASocket).toHaveBeenCalledTimes(1);
    expect(getWhatsAppStatus().status).toBe("connecting");
  });

  it("keeps Pair idempotent while a pairing connection is already starting", async () => {
    const { getWhatsAppStatus, pairWhatsApp } = await import("../whatsapp.js");
    const { clearWhatsAppBinding } = await import("./binding-store.js");

    clearWhatsAppBinding();

    await expect(pairWhatsApp()).resolves.toEqual({ status: "connecting" });
    await expect(pairWhatsApp()).resolves.toEqual({ status: "connecting" });

    expect(baileysMock.makeWASocket).toHaveBeenCalledTimes(1);
    expect(getWhatsAppStatus()).toMatchObject({
      status: "connecting",
      binding: { state: "unbound" },
    });
  });

  it("moves the public pairing state to qr when Baileys emits a QR payload", async () => {
    const { getCurrentQr, pairWhatsApp } = await import("../whatsapp.js");
    const { clearWhatsAppBinding } = await import("./binding-store.js");

    clearWhatsAppBinding();
    await pairWhatsApp();

    baileysMock.ev.emit("connection.update", { qr: "contract-qr-payload" });

    expect(getCurrentQr()).toEqual({
      qr: "contract-qr-payload",
      status: "qr",
    });
  });

  it("rebind clears the old binding, logs out the active socket, clears auth files, and starts one replacement socket", async () => {
    const { getWhatsAppStatus, initializeWhatsApp, rebindWhatsApp } = await import("../whatsapp.js");
    const { clearWhatsAppBinding } = await import("./binding-store.js");

    clearWhatsAppBinding();
    await initializeWhatsApp();
    baileysMock.ev.emit("connection.update", { connection: "open" });
    expect(getWhatsAppStatus().binding.state).toBe("bound");

    await expect(rebindWhatsApp()).resolves.toEqual({ status: "connecting" });

    expect(baileysMock.logout).toHaveBeenCalledTimes(1);
    expect(fsMock.rm).toHaveBeenCalledTimes(1);
    expect(fsMock.mkdir).toHaveBeenCalledTimes(1);
    expect(baileysMock.makeWASocket).toHaveBeenCalledTimes(2);
    expect(getWhatsAppStatus()).toMatchObject({
      status: "connecting",
      binding: { state: "unbound" },
      accountHealth: {
        availability: "unavailable",
        unavailableReason: "not_connected",
      },
    });
  });
});
