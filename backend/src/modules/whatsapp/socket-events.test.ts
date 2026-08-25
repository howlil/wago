import { WAMessageStatus, type WASocket } from "@whiskeysockets/baileys";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateMessageStatus: vi.fn(),
  auditBaileys: vi.fn(),
}));

vi.mock("./message-status-store.js", () => ({
  updateMessageStatus: mocks.updateMessageStatus,
}));

vi.mock("./observability.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./observability.js")>();
  return {
    ...original,
    auditBaileys: mocks.auditBaileys,
  };
});

import { registerSocketEvents } from "./socket-events.js";

type Handler = (...args: unknown[]) => void;

function fakeSocketEvents() {
  const handlers = new Map<string, Handler>();
  return {
    on: vi.fn((event: string, handler: Handler) => {
      handlers.set(event, handler);
    }),
    emit(event: string, ...args: unknown[]) {
      handlers.get(event)?.(...args);
    },
  };
}

function register(ev = fakeSocketEvents()) {
  const socket = { ev } as unknown as WASocket;
  registerSocketEvents({
    socket,
    generation: 7,
    saveCreds: vi.fn(async () => undefined),
    credentialWriter: { enqueue: vi.fn() },
    isCurrentGeneration: vi.fn(() => true),
    getReconnectAttempt: vi.fn(() => 0),
    resetReconnectAttempt: vi.fn(),
    scheduleReconnect: vi.fn(),
  });
  return { ev, socket };
}

describe("socket event wiring", () => {
  afterEach(() => {
    mocks.updateMessageStatus.mockClear();
    mocks.auditBaileys.mockClear();
  });

  it("registers the three Baileys event boundaries", () => {
    const { ev } = register();

    expect(ev.on).toHaveBeenCalledWith("creds.update", expect.any(Function));
    expect(ev.on).toHaveBeenCalledWith("messages.update", expect.any(Function));
    expect(ev.on).toHaveBeenCalledWith("connection.update", expect.any(Function));
  });

  it("does not persist credential events from a stale socket generation", () => {
    const ev = fakeSocketEvents();
    const socket = { ev } as unknown as WASocket;
    const enqueue = vi.fn();
    const saveCreds = vi.fn(async () => undefined);
    const isCurrentGeneration = vi.fn(() => false);

    registerSocketEvents({
      socket,
      generation: 7,
      saveCreds,
      credentialWriter: { enqueue },
      isCurrentGeneration,
      getReconnectAttempt: vi.fn(() => 0),
      resetReconnectAttempt: vi.fn(),
      scheduleReconnect: vi.fn(),
    });

    ev.emit("creds.update");
    expect(enqueue).not.toHaveBeenCalled();

    isCurrentGeneration.mockReturnValue(true);
    ev.emit("creds.update");
    expect(enqueue).toHaveBeenCalledWith(saveCreds, 7);
  });

  it.each([
    [WAMessageStatus.SERVER_ACK, "accepted"],
    [WAMessageStatus.DELIVERY_ACK, "delivered"],
    [WAMessageStatus.READ, "read"],
    [WAMessageStatus.PLAYED, "read"],
  ] as const)("maps Baileys status %s to %s", (status, expectedStatus) => {
    const { ev } = register();

    ev.emit("messages.update", [
      {
        key: { id: "message-1" },
        update: { status },
      },
    ]);

    expect(mocks.updateMessageStatus).toHaveBeenCalledWith("message-1", { status: expectedStatus });
  });
});
