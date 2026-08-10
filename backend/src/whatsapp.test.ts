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
    off(event: string, handler: Handler): void {
      handlers.get(event)?.delete(handler);
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
    fetchLatestBaileysVersion: vi.fn(async () => ({ version: [2, 3000, 0] })),
    makeWASocket: vi.fn(),
    onWhatsApp: vi.fn(),
    saveCreds: vi.fn(),
    sendMessage: vi.fn(),
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
  fetchLatestBaileysVersion: baileysMock.fetchLatestBaileysVersion,
  useMultiFileAuthState: baileysMock.useMultiFileAuthState,
  WAMessageStatus: {
    ERROR: 0,
    SERVER_ACK: 1,
  },
}));

describe("whatsapp send semantics", () => {
  beforeEach(async () => {
    vi.useRealTimers();
    vi.resetModules();
    baileysMock.ev.removeAllListeners();
    baileysMock.fetchLatestBaileysVersion.mockClear();
    baileysMock.makeWASocket.mockClear();
    baileysMock.onWhatsApp.mockReset();
    baileysMock.saveCreds.mockReset();
    baileysMock.sendMessage.mockReset();
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
      onWhatsApp: baileysMock.onWhatsApp,
      sendMessage: baileysMock.sendMessage,
      end: baileysMock.end,
      logout: baileysMock.logout,
    });
    baileysMock.fetchAccountReachoutTimelock.mockResolvedValue(undefined);
    baileysMock.fetchNewChatMessageCap.mockResolvedValue(undefined);
    baileysMock.onWhatsApp.mockResolvedValue([
      {
        exists: true,
        jid: "6281234567890@s.whatsapp.net",
      },
    ]);
    baileysMock.sendMessage.mockResolvedValue({
      key: {
        id: "message-1",
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns pending immediately after Baileys accepts the send request", async () => {
    const { initializeWhatsApp, sendTextMessage } = await import("./whatsapp.js");
    const { allowRecipient, resetRecipientStoreForTest } = await import("./recipients/store.js");

    await resetRecipientStoreForTest();
    await allowRecipient("6281234567890");
    await initializeWhatsApp();
    baileysMock.ev.emit("connection.update", { connection: "open" });

    await expect(sendTextMessage("6281234567890", "Hello")).resolves.toEqual({
      messageId: "message-1",
      status: "pending",
    });
  });

  it("keeps message status pending until a Baileys status update arrives", async () => {
    const { getMessageStatus, initializeWhatsApp, sendTextMessage } = await import("./whatsapp.js");
    const { allowRecipient, resetRecipientStoreForTest } = await import("./recipients/store.js");

    await resetRecipientStoreForTest();
    await allowRecipient("6281234567890");
    await initializeWhatsApp();
    baileysMock.ev.emit("connection.update", { connection: "open" });

    const result = await sendTextMessage("6281234567890", "Hello");
    const messageId = result.messageId;

    expect(messageId).toBe("message-1");
    expect(getMessageStatus(messageId ?? "")).toMatchObject({
      id: "message-1",
      status: "pending",
    });

    baileysMock.ev.emit("messages.update", [
      {
        key: {
          id: "message-1",
        },
        update: {
          status: 1,
        },
      },
    ]);

    expect(getMessageStatus(messageId ?? "")).toMatchObject({
      id: "message-1",
      status: "accepted",
    });
  });

  it("caches successful recipient lookup for repeated sends", async () => {
    const { initializeWhatsApp, sendTextMessage } = await import("./whatsapp.js");
    const { allowRecipient, resetRecipientStoreForTest } = await import("./recipients/store.js");

    await resetRecipientStoreForTest();
    await allowRecipient("6281234567890");
    await initializeWhatsApp();
    baileysMock.ev.emit("connection.update", { connection: "open" });

    await sendTextMessage("6281234567890", "Hello");
    await sendTextMessage("6281234567890", "Hello again");

    expect(baileysMock.onWhatsApp).toHaveBeenCalledTimes(1);
  });

  it("updates account health from connection reachout timelock", async () => {
    const { getWhatsAppStatus, initializeWhatsApp } = await import("./whatsapp.js");
    const retryAt = new Date("2026-08-09T00:30:00.000Z");

    await initializeWhatsApp();
    baileysMock.ev.emit("connection.update", {
      reachoutTimeLock: {
        isActive: true,
        timeEnforcementEnds: retryAt,
        enforcementType: "WEB_COMPANION_ONLY",
      },
    });

    expect(getWhatsAppStatus().accountHealth.reachoutTimeLock).toEqual({
      isActive: true,
      retryAt: "2026-08-09T00:30:00.000Z",
      enforcementType: "WEB_COMPANION_ONLY",
    });
  });

  it("schedules reconnect with backoff instead of reconnecting immediately", async () => {
    vi.useFakeTimers();
    const { initializeWhatsApp } = await import("./whatsapp.js");

    await initializeWhatsApp();
    expect(baileysMock.makeWASocket).toHaveBeenCalledTimes(1);

    baileysMock.ev.emit("connection.update", {
      connection: "close",
      lastDisconnect: {
        error: {
          output: {
            statusCode: 428,
          },
        },
      },
    });

    expect(baileysMock.makeWASocket).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2400);

    expect(baileysMock.makeWASocket).toHaveBeenCalledTimes(2);
  });

  it("keeps binding but invalidates health after a recoverable disconnect", async () => {
    const { getWhatsAppStatus, initializeWhatsApp } = await import("./whatsapp.js");
    const { bindWhatsAppAccount, clearWhatsAppBinding } = await import("./whatsapp/binding-store.js");
    const { refreshAccountHealth } = await import("./whatsapp/account-health.js");

    clearWhatsAppBinding();
    bindWhatsAppAccount("6281234567890@s.whatsapp.net");
    await refreshAccountHealth(
      {
        fetchAccountReachoutTimelock: async () => ({ isActive: false }),
        fetchNewChatMessageCap: async () => ({ capping_status: "NONE" }),
      },
      { force: true },
    );
    await initializeWhatsApp();

    baileysMock.ev.emit("connection.update", {
      connection: "close",
      lastDisconnect: { error: { output: { statusCode: 428 } } },
    });

    expect(getWhatsAppStatus()).toMatchObject({
      status: "disconnected",
      binding: { state: "bound" },
      accountHealth: {
        availability: "unavailable",
        unavailableReason: "not_connected",
      },
    });
  });

  it("clears binding and marks the session invalid after logged-out close", async () => {
    vi.useFakeTimers();
    const { getWhatsAppStatus, initializeWhatsApp } = await import("./whatsapp.js");
    const { bindWhatsAppAccount, clearWhatsAppBinding } = await import("./whatsapp/binding-store.js");
    const { refreshAccountHealth } = await import("./whatsapp/account-health.js");

    clearWhatsAppBinding();
    bindWhatsAppAccount("6281234567890@s.whatsapp.net");
    await refreshAccountHealth(
      {
        fetchAccountReachoutTimelock: async () => ({ isActive: false }),
        fetchNewChatMessageCap: async () => ({ capping_status: "NONE" }),
      },
      { force: true },
    );
    await initializeWhatsApp();

    baileysMock.ev.emit("connection.update", {
      connection: "close",
      lastDisconnect: { error: { output: { statusCode: 401 } } },
    });

    expect(getWhatsAppStatus()).toMatchObject({
      status: "disconnected",
      binding: { state: "unbound" },
      accountHealth: {
        availability: "unavailable",
        unavailableReason: "session_invalid",
      },
    });

    await vi.advanceTimersByTimeAsync(60000);
    expect(baileysMock.makeWASocket).toHaveBeenCalledTimes(1);
  });

  it("does not schedule reconnect after logged-out close", async () => {
    vi.useFakeTimers();
    const { initializeWhatsApp } = await import("./whatsapp.js");

    await initializeWhatsApp();

    baileysMock.ev.emit("connection.update", {
      connection: "close",
      lastDisconnect: {
        error: {
          output: {
            statusCode: 401,
          },
        },
      },
    });

    await vi.advanceTimersByTimeAsync(60000);

    expect(baileysMock.makeWASocket).toHaveBeenCalledTimes(1);
  });

  it("closes the socket without logout during ordinary shutdown", async () => {
    vi.useFakeTimers();
    const { getWhatsAppStatus, initializeWhatsApp, shutdownWhatsApp } = await import("./whatsapp.js");
    const { refreshAccountHealth } = await import("./whatsapp/account-health.js");

    await refreshAccountHealth(
      {
        fetchAccountReachoutTimelock: async () => ({ isActive: false }),
        fetchNewChatMessageCap: async () => ({ capping_status: "NONE" }),
      },
      { force: true },
    );
    await initializeWhatsApp();
    await shutdownWhatsApp();

    expect(baileysMock.end).toHaveBeenCalledTimes(1);
    expect(baileysMock.logout).not.toHaveBeenCalled();
    expect(getWhatsAppStatus().accountHealth).toMatchObject({
      availability: "unavailable",
      unavailableReason: "not_connected",
    });

    baileysMock.ev.emit("connection.update", {
      connection: "close",
      lastDisconnect: {
        error: {
          output: {
            statusCode: 428,
          },
        },
      },
    });

    await vi.advanceTimersByTimeAsync(60000);

    expect(baileysMock.makeWASocket).toHaveBeenCalledTimes(1);
  });

  it("returns to disconnected when initialization fails", async () => {
    baileysMock.useMultiFileAuthState.mockRejectedValueOnce(new Error("auth read failed"));
    const { getWhatsAppStatus, initializeWhatsApp } = await import("./whatsapp.js");

    await expect(initializeWhatsApp()).rejects.toThrow("auth read failed");

    expect(getWhatsAppStatus().status).toBe("disconnected");
    expect(getWhatsAppStatus().accountHealth).toMatchObject({
      availability: "unavailable",
      unavailableReason: "not_connected",
    });
  });

  it("uses bundled Baileys version", async () => {
    const { initializeWhatsApp } = await import("./whatsapp.js");

    await initializeWhatsApp();

    expect(baileysMock.fetchLatestBaileysVersion).not.toHaveBeenCalled();
    expect(baileysMock.makeWASocket).toHaveBeenCalledWith(
      expect.objectContaining({
        getMessage: expect.any(Function),
      }),
    );
    expect(baileysMock.makeWASocket.mock.calls[0]?.[0]).not.toHaveProperty("version");
  });
});
