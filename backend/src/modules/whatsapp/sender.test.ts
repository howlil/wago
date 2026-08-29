import type { WASocket } from "@whiskeysockets/baileys";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetOutboundPolicyState } from "../messages/outbound-policy.js";
import { allowRecipientJid, getRecipientByJid, resetRecipientStoreForTest } from "../recipients/store.js";
import { resetAccountHealthForTest } from "./account-health.js";
import { resetMessageStatusStoreForTest } from "./message-status-store.js";
import { resetRecipientLookupCacheForTest } from "./recipient-cache.js";
import { createWhatsAppSender } from "./sender.js";

const fakeSocket = {} as WASocket;
const recipientJid = "6281234567890@s.whatsapp.net";

function connectedSocket(sendMessage: (...args: unknown[]) => unknown): WASocket {
  return {
    onWhatsApp: vi.fn(async (jid: string) => [{ exists: true, jid }]),
    sendMessage,
    fetchAccountReachoutTimelock: vi.fn(async () => ({ isActive: false })),
    fetchNewChatMessageCap: vi.fn(async () => ({ capping_status: "NONE" })),
  } as unknown as WASocket;
}

describe("WhatsApp sender", () => {
  beforeEach(async () => {
    await resetOutboundPolicyState();
    await resetRecipientStoreForTest();
    resetAccountHealthForTest();
    resetMessageStatusStoreForTest();
    resetRecipientLookupCacheForTest();
    await allowRecipientJid(recipientJid);
  });

  afterEach(async () => {
    await resetOutboundPolicyState();
    await resetRecipientStoreForTest();
    resetAccountHealthForTest();
    resetMessageStatusStoreForTest();
    resetRecipientLookupCacheForTest();
  });

  it("returns a typed disconnected error before touching Baileys", async () => {
    const sender = createWhatsAppSender({
      getSocket: () => undefined,
      getConnectionStatus: () => "disconnected",
    });

    await expect(sender.sendText("6281234567890", "hello")).rejects.toMatchObject({
      name: "ApplicationError",
      code: "WHATSAPP_NOT_CONNECTED",
    });
  });

  it("normalizes invalid phone input into a typed application error", async () => {
    const sender = createWhatsAppSender({
      getSocket: () => fakeSocket,
      getConnectionStatus: () => "connected",
    });

    await expect(sender.sendText("not-a-phone", "hello")).rejects.toMatchObject({
      name: "ApplicationError",
      code: "INVALID_PHONE",
    });
  });

  it("allows only one Baileys side effect for concurrent requests with the same idempotency key", async () => {
    let releaseFirstSend!: () => void;
    const sendMessage = vi.fn(
      () =>
        new Promise((resolve) => {
          releaseFirstSend = () => resolve({ key: { id: "msg-1" } });
        }),
    );
    const socket = connectedSocket(sendMessage);
    const sender = createWhatsAppSender({
      getSocket: () => socket,
      getConnectionStatus: () => "connected",
    });

    const first = sender.sendText("6281234567890", "first", { idempotencyKey: "same-request" });
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));

    const second = sender.sendText("6281234567890", "second", { idempotencyKey: "same-request" });
    await Promise.resolve();
    expect(sendMessage).toHaveBeenCalledTimes(1);

    releaseFirstSend();
    await expect(first).resolves.toEqual({ messageId: "msg-1", status: "pending" });
    await expect(second).rejects.toMatchObject({ code: "DUPLICATE_MESSAGE" });
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("does not mark a submitted message as a successful recipient interaction before acknowledgement", async () => {
    const socket = connectedSocket(vi.fn(async () => ({ key: { id: "msg-pending" } })));
    const sender = createWhatsAppSender({
      getSocket: () => socket,
      getConnectionStatus: () => "connected",
    });

    await expect(sender.sendText("6281234567890", "hello")).resolves.toEqual({
      messageId: "msg-pending",
      status: "pending",
    });

    expect((await getRecipientByJid(recipientJid))?.lastSuccessfulOutboundAt).toBeUndefined();
  });
});
