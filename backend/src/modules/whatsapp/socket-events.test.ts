import { WAMessageStatus, type WASocket } from "@whiskeysockets/baileys";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMessageStatus,
  rememberPendingMessageStatus,
  resetMessageStatusStoreForTest,
} from "../messages/message-status-store.js";
import { checkOutboundPolicy, resetOutboundPolicyState } from "../messages/outbound-policy.js";
import { allowRecipientJid, getRecipientByJid, resetRecipientStoreForTest } from "../recipients/store.js";
import { resetAccountHealthForTest } from "./account-health.js";
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

function register(socket: WASocket): void {
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
}

describe("socket event wiring", () => {
  it("registers the three Baileys event boundaries", () => {
    const ev = fakeSocketEvents();
    const socket = { ev } as unknown as WASocket;

    register(socket);

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

describe("outbound message outcomes", () => {
  const recipientJid = "6281234567890@s.whatsapp.net";
  const resolvedJid = "6281234567890:1@s.whatsapp.net";

  beforeEach(async () => {
    await resetOutboundPolicyState();
    await resetRecipientStoreForTest();
    resetMessageStatusStoreForTest();
    resetAccountHealthForTest();
    await allowRecipientJid(recipientJid);
  });

  afterEach(async () => {
    await resetOutboundPolicyState();
    await resetRecipientStoreForTest();
    resetMessageStatusStoreForTest();
    resetAccountHealthForTest();
  });

  function outcomeSocket() {
    const ev = fakeSocketEvents();
    const socket = {
      ev,
      fetchAccountReachoutTimelock: vi.fn(async () => ({ isActive: false })),
      fetchNewChatMessageCap: vi.fn(async () => ({ capping_status: "NONE" })),
    } as unknown as WASocket;
    register(socket);
    return { ev, socket };
  }

  it("marks recipient success only when WhatsApp reports server acknowledgement", async () => {
    const { ev } = outcomeSocket();
    rememberPendingMessageStatus({
      id: "trace-ack",
      providerMessageId: "provider-ack",
      to: resolvedJid,
      recipientJid,
    });

    expect((await getRecipientByJid(recipientJid))?.lastSuccessfulOutboundAt).toBeUndefined();

    ev.emit("messages.update", [
      {
        key: { id: "provider-ack" },
        update: { status: WAMessageStatus.SERVER_ACK },
      },
    ]);

    expect((await getRecipientByJid(recipientJid))?.lastSuccessfulOutboundAt).toBeDefined();
    expect(getMessageStatus("trace-ack")?.status).toBe("accepted");
  });

  it("applies recipient cooldown when WhatsApp asynchronously rejects a reach-out", async () => {
    const { ev } = outcomeSocket();
    rememberPendingMessageStatus({
      id: "trace-rejected",
      providerMessageId: "provider-rejected",
      to: resolvedJid,
      recipientJid,
    });

    ev.emit("messages.update", [
      {
        key: { id: "provider-rejected" },
        update: {
          status: WAMessageStatus.ERROR,
          messageStubParameters: ["463"],
        },
      },
    ]);

    const decision = await checkOutboundPolicy({
      to: "6281234567890",
      jid: recipientJid,
      text: "retry",
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toBe("WA_REACHOUT_RESTRICTED");
      expect(decision.retryAt).toBeInstanceOf(Date);
    }
    expect(getMessageStatus("trace-rejected")?.status).toBe("rejected");
  });
});
