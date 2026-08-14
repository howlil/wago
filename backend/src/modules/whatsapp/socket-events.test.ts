import type { WASocket } from "@whiskeysockets/baileys";
import { describe, expect, it, vi } from "vitest";
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

describe("socket event wiring", () => {
  it("registers the three Baileys event boundaries", () => {
    const ev = fakeSocketEvents();
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
});
