import { WAMessageStatus, type WASocket } from "@whiskeysockets/baileys";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMessageStatus,
  rememberPendingMessageStatus,
  resetMessageStatusStoreForTest,
} from "../messages/message-status-store.js";
import { checkOutboundPolicy, resetOutboundPolicyState } from "../messages/outbound-policy.js";
import { allowRecipientJid, getRecipientByJid, resetRecipientStoreForTest } from "../recipients/store.js";
import { checkAccountHealth, getAccountHealthSnapshot, resetAccountHealthForTest } from "./account-health.js";
import { invalidateRecipientLookupCache, resolveRecipientJid } from "./recipient-cache.js";
import { getRecipientIdentity, resetRecipientIdentityStoreForTest } from "./recipient-identity-store.js";
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
  afterEach(async () => {
    resetAccountHealthForTest();
    resetRecipientIdentityStoreForTest();
    invalidateRecipientLookupCache();
    await resetRecipientStoreForTest();
  });

  it("registers the Baileys reliability event boundaries", () => {
    const ev = fakeSocketEvents();
    const socket = { ev } as unknown as WASocket;

    register(socket);

    for (const event of [
      "creds.update",
      "lid-mapping.update",
      "message-capping.update",
      "messages.upsert",
      "messages.update",
      "message-receipt.update",
      "connection.update",
    ]) {
      expect(ev.on).toHaveBeenCalledWith(event, expect.any(Function));
    }
  });

  it("routes only live direct incoming text notifications", () => {
    const ev = fakeSocketEvents();
    const socket = { ev } as unknown as WASocket;
    const onIncomingMessage = vi.fn();

    registerSocketEvents({
      socket,
      generation: 7,
      saveCreds: vi.fn(async () => undefined),
      credentialWriter: { enqueue: vi.fn() },
      isCurrentGeneration: vi.fn(() => true),
      getReconnectAttempt: vi.fn(() => 0),
      resetReconnectAttempt: vi.fn(),
      scheduleReconnect: vi.fn(),
      onIncomingMessage,
    });

    const inbound = {
      key: { id: "provider-inbound", remoteJid: "6281234567890@s.whatsapp.net", fromMe: false },
      message: { conversation: "hello" },
    };

    ev.emit("messages.upsert", { type: "append", messages: [inbound] });
    expect(onIncomingMessage).not.toHaveBeenCalled();

    ev.emit("messages.upsert", { type: "notify", messages: [inbound] });
    expect(onIncomingMessage).toHaveBeenCalledTimes(1);
    expect(onIncomingMessage).toHaveBeenCalledWith(expect.objectContaining({ from: "6281234567890", text: "hello" }));
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

  it("applies realtime new-chat capping state without blocking warnings", async () => {
    const ev = fakeSocketEvents();
    const socket = { ev } as unknown as WASocket;
    register(socket);

    ev.emit("message-capping.update", {
      capping_status: "FIRST_WARNING",
      used_quota: 42,
      total_quota: 50,
    });

    expect(getAccountHealthSnapshot()).toMatchObject({
      newChatCapacity: { status: "warning", used: 42, total: 50 },
    });
    await expect(checkAccountHealth(undefined, { isNewRecipient: true })).resolves.toEqual({ allowed: true });

    ev.emit("message-capping.update", { capping_status: "CAPPED", used_quota: 50, total_quota: 50 });
    await expect(checkAccountHealth(undefined, { isNewRecipient: true })).resolves.toMatchObject({
      allowed: false,
      reason: "WA_NEW_CHAT_CAPPED",
    });
  });

  it("persists a LID mapping and invalidates stale recipient resolution", async () => {
    const ev = fakeSocketEvents();
    const phoneJid = "6281234567890@s.whatsapp.net";
    const lidJid = "123456789012345@lid";
    const onWhatsApp = vi.fn(async () => [{ exists: true, jid: "old@s.whatsapp.net" }]);
    const socket = { ev, onWhatsApp } as unknown as WASocket;
    register(socket);

    await allowRecipientJid(phoneJid);
    await resolveRecipientJid(socket, phoneJid);
    expect(onWhatsApp).toHaveBeenCalledTimes(1);

    ev.emit("lid-mapping.update", { pn: phoneJid, lid: lidJid });

    expect(getRecipientIdentity(phoneJid)?.lidJid).toBe(lidJid);
    await expect(resolveRecipientJid(socket, phoneJid)).resolves.toBe(lidJid);
    expect(onWhatsApp).toHaveBeenCalledTimes(1);
    expect((await getRecipientByJid(phoneJid))?.resolvedJid).toBe(lidJid);
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
    resetRecipientIdentityStoreForTest();
    invalidateRecipientLookupCache();
    await allowRecipientJid(recipientJid);
  });

  afterEach(async () => {
    await resetOutboundPolicyState();
    await resetRecipientStoreForTest();
    resetMessageStatusStoreForTest();
    resetAccountHealthForTest();
    resetRecipientIdentityStoreForTest();
    invalidateRecipientLookupCache();
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

  it("marks recipient success and server acceptance evidence on acknowledgement", async () => {
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
    expect(getMessageStatus("trace-ack")).toMatchObject({
      status: "accepted",
      deliveryEvidence: "server_accepted",
    });
    expect(getMessageStatus("trace-ack")?.serverAcceptedAt).toBeDefined();
  });

  it("promotes delivery evidence monotonically from delivered to read to played", () => {
    const { ev } = outcomeSocket();
    rememberPendingMessageStatus({
      id: "trace-receipt",
      providerMessageId: "provider-receipt",
      to: resolvedJid,
      recipientJid,
    });
    ev.emit("messages.update", [{ key: { id: "provider-receipt" }, update: { status: WAMessageStatus.SERVER_ACK } }]);

    ev.emit("message-receipt.update", [
      { key: { id: "provider-receipt" }, receipt: { receiptTimestamp: 1_788_000_000 } },
    ]);
    expect(getMessageStatus("trace-receipt")?.deliveryEvidence).toBe("delivered");

    ev.emit("message-receipt.update", [{ key: { id: "provider-receipt" }, receipt: { readTimestamp: 1_788_000_010 } }]);
    expect(getMessageStatus("trace-receipt")?.deliveryEvidence).toBe("read");

    ev.emit("message-receipt.update", [
      { key: { id: "provider-receipt" }, receipt: { receiptTimestamp: 1_788_000_020 } },
    ]);
    expect(getMessageStatus("trace-receipt")?.deliveryEvidence).toBe("read");

    ev.emit("message-receipt.update", [
      { key: { id: "provider-receipt" }, receipt: { playedTimestamp: 1_788_000_030 } },
    ]);
    expect(getMessageStatus("trace-receipt")).toMatchObject({
      deliveryEvidence: "played",
      deliveredAt: expect.any(String),
      readAt: expect.any(String),
      playedAt: expect.any(String),
    });
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
