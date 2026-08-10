import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    end: vi.fn(),
    logout: vi.fn(),
    fetchAccountReachoutTimelock: vi.fn(),
    fetchNewChatMessageCap: vi.fn(),
    useMultiFileAuthState: vi.fn(),
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

describe("Baileys lifecycle audit", () => {
  beforeEach(async () => {
    vi.useRealTimers();
    vi.resetModules();
    baileysMock.ev.removeAllListeners();
    baileysMock.makeWASocket.mockReset();
    baileysMock.saveCreds.mockReset();
    baileysMock.end.mockReset();
    baileysMock.logout.mockReset();
    baileysMock.fetchAccountReachoutTimelock.mockReset();
    baileysMock.fetchNewChatMessageCap.mockReset();
    baileysMock.useMultiFileAuthState.mockReset();

    baileysMock.useMultiFileAuthState.mockResolvedValue({
      state: {},
      saveCreds: baileysMock.saveCreds,
    });
    baileysMock.makeWASocket.mockReturnValue({
      ev: baileysMock.ev,
      fetchAccountReachoutTimelock: baileysMock.fetchAccountReachoutTimelock,
      fetchNewChatMessageCap: baileysMock.fetchNewChatMessageCap,
      end: baileysMock.end,
      logout: baileysMock.logout,
    });
    baileysMock.fetchAccountReachoutTimelock.mockResolvedValue(undefined);
    baileysMock.fetchNewChatMessageCap.mockResolvedValue(undefined);

    const { resetActivityLogForTest } = await import("../activity/store.js");
    await resetActivityLogForTest();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("records QR availability and terminal disconnect without persisting the QR", async () => {
    const { initializeWhatsApp } = await import("../whatsapp.js");
    const { listAudit } = await import("../activity/query.js");

    await initializeWhatsApp();
    baileysMock.ev.emit("connection.update", { qr: "raw-secret-qr" });
    baileysMock.ev.emit("connection.update", {
      connection: "close",
      lastDisconnect: { error: { output: { statusCode: 401 } } },
    });

    const page = await listAudit({ limit: 20, source: "baileys" });
    const qrEvent = page.events.find((event) => event.code === "baileys.connection.qr_ready");
    const closeEvent = page.events.find((event) => event.code === "baileys.connection.close");
    const invalidatedEvent = page.events.find((event) => event.code === "baileys.session.invalidated");

    expect(qrEvent).toBeDefined();
    expect(JSON.stringify(qrEvent)).not.toContain("raw-secret-qr");
    expect(closeEvent).toMatchObject({
      metadata: {
        statusCode: 401,
        reason: "logged_out",
        terminal: true,
        reconnect: false,
      },
    });
    expect(invalidatedEvent).toBeDefined();
  });

  it("records reconnect scheduling for a recoverable disconnect", async () => {
    vi.useFakeTimers();
    const { initializeWhatsApp } = await import("../whatsapp.js");
    const { listAudit } = await import("../activity/query.js");

    await initializeWhatsApp();
    baileysMock.ev.emit("connection.update", {
      connection: "close",
      lastDisconnect: { error: { output: { statusCode: 428 } } },
    });

    const page = await listAudit({ limit: 20, source: "baileys" });
    expect(page.events.find((event) => event.code === "baileys.reconnect.scheduled")).toMatchObject({
      metadata: {
        reconnectAttempt: 1,
      },
    });
  });

  it("records unknown disconnect status explicitly and keeps it recoverable", async () => {
    vi.useFakeTimers();
    const { initializeWhatsApp } = await import("../whatsapp.js");
    const { listAudit } = await import("../activity/query.js");

    await initializeWhatsApp();
    baileysMock.ev.emit("connection.update", {
      connection: "close",
      lastDisconnect: { error: { output: { statusCode: 599 } } },
    });

    const page = await listAudit({ limit: 20, source: "baileys", category: "connection" });
    const closeEvent = page.events.find((event) => event.code === "baileys.connection.close");

    expect(closeEvent).toMatchObject({
      metadata: {
        statusCode: 599,
        reason: "status_599",
        terminal: false,
        reconnect: true,
      },
    });
    expect(page.events.find((event) => event.code === "baileys.session.invalidated")).toBeUndefined();
    expect(page.events.find((event) => event.code === "baileys.reconnect.scheduled")).toBeDefined();
  });

  it("records missing persisted auth on restart and requires pairing", async () => {
    const { getWhatsAppStatus, resumeWhatsAppSession } = await import("../whatsapp.js");
    const { listAudit } = await import("../activity/query.js");

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

    const page = await listAudit({ limit: 20, source: "baileys", category: "connection" });
    expect(page.events.find((event) => event.code === "baileys.session.auth_missing")).toBeDefined();
  });

  it("records credential persistence failures without credential content", async () => {
    baileysMock.saveCreds.mockRejectedValueOnce(new Error("disk failed"));
    const { initializeWhatsApp, shutdownWhatsApp } = await import("../whatsapp.js");
    const { listAudit } = await import("../activity/query.js");

    await initializeWhatsApp();
    baileysMock.ev.emit("creds.update", { secret: "never-persist-this" });
    await shutdownWhatsApp();

    const page = await listAudit({ limit: 20, source: "baileys" });
    const failure = page.events.find((event) => event.code === "baileys.credentials.persist_failed");
    expect(failure).toBeDefined();
    expect(JSON.stringify(failure)).not.toContain("never-persist-this");
  });

  it("records message acknowledgement without persisting message identity or body", async () => {
    const { initializeWhatsApp } = await import("../whatsapp.js");
    const { listAudit } = await import("../activity/query.js");

    await initializeWhatsApp();
    baileysMock.ev.emit("messages.update", [
      {
        key: { id: "secret-message-id" },
        update: { status: 1 },
      },
    ]);

    const page = await listAudit({ limit: 20, source: "baileys" });
    const ack = page.events.find((event) => event.code === "baileys.message.ack");
    expect(ack).toBeDefined();
    expect(JSON.stringify(ack)).not.toContain("secret-message-id");
  });
});
