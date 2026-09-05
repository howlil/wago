import type { WASocket } from "@whiskeysockets/baileys";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rememberPendingMessageStatus, resetMessageStatusStoreForTest } from "../messages/message-status-store.js";
import { resetRecentInboundStoreForTest } from "./recent-inbound-store.js";
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

function register(socket: WASocket, overrides: Record<string, unknown> = {}) {
  registerSocketEvents({
    socket,
    generation: 7,
    saveCreds: vi.fn(async () => undefined),
    credentialWriter: { enqueue: vi.fn() },
    isCurrentGeneration: vi.fn(() => true),
    getReconnectAttempt: vi.fn(() => 0),
    resetReconnectAttempt: vi.fn(),
    scheduleReconnect: vi.fn(),
    ...overrides,
  });
}

describe("socket contextual inbound events", () => {
  afterEach(() => {
    resetMessageStatusStoreForTest();
    resetRecentInboundStoreForTest();
  });

  it("maps a quoted provider id back to the canonical Wago outbound id", () => {
    rememberPendingMessageStatus({
      id: "wago-outbound-1",
      providerMessageId: "provider-outbound-1",
      to: "6281234567890@s.whatsapp.net",
      recipientJid: "6281234567890@s.whatsapp.net",
    });
    const ev = fakeSocketEvents();
    const onIncomingMessage = vi.fn();
    const socket = { ev } as unknown as WASocket;
    register(socket, { onIncomingMessage });

    ev.emit("messages.upsert", {
      type: "notify",
      messages: [
        {
          key: { id: "provider-inbound-1", remoteJid: "6281234567890@s.whatsapp.net", fromMe: false },
          message: {
            extendedTextMessage: {
              text: "reply",
              contextInfo: { stanzaId: "provider-outbound-1" },
            },
          },
        },
      ],
    });

    expect(onIncomingMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "6281234567890",
        text: "reply",
        replyToMessageId: "wago-outbound-1",
      }),
    );
    expect(onIncomingMessage.mock.calls[0]?.[0]).not.toHaveProperty("quotedProviderMessageId");
  });

  it("emits supported inbound media metadata without media bytes", () => {
    const ev = fakeSocketEvents();
    const onIncomingMediaMessage = vi.fn();
    const socket = { ev } as unknown as WASocket;
    register(socket, { onIncomingMediaMessage });

    ev.emit("messages.upsert", {
      type: "notify",
      messages: [
        {
          key: { id: "provider-image", remoteJid: "6281234567890@s.whatsapp.net", fromMe: false },
          message: {
            imageMessage: {
              url: "https://example.invalid/media",
              mimetype: "image/jpeg",
              caption: "proof",
              fileLength: 123,
              width: 640,
              height: 480,
            },
          },
        },
      ],
    });

    expect(onIncomingMediaMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "6281234567890",
        media: expect.objectContaining({
          kind: "image",
          mimetype: "image/jpeg",
          caption: "proof",
          fileLength: 123,
        }),
      }),
    );
    expect(onIncomingMediaMessage.mock.calls[0]?.[0]).not.toHaveProperty("data");
  });
});
