import type { WAMessage, WASocket } from "@whiskeysockets/baileys";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMessageStatusStoreForTest } from "../messages/message-status-store.js";
import { resetOutboundPolicyState } from "../messages/outbound-policy.js";
import { allowRecipientJid, resetRecipientStoreForTest } from "../recipients/store.js";
import { resetAccountHealthForTest } from "./account-health.js";
import { rememberRecentInboundMessage, resetRecentInboundStoreForTest } from "./recent-inbound-store.js";
import { resetRecipientLookupCacheForTest } from "./recipient-cache.js";
import { createWhatsAppSender } from "./sender.js";

const recipient = "6281234567890";
const recipientJid = `${recipient}@s.whatsapp.net`;

function connectedSocket(sendMessage: (...args: unknown[]) => unknown): WASocket {
  return {
    onWhatsApp: vi.fn(async (jid: string) => [{ exists: true, jid }]),
    sendMessage,
    fetchAccountReachoutTimelock: vi.fn(async () => ({ isActive: false })),
    fetchNewChatMessageCap: vi.fn(async () => ({ capping_status: "NONE" })),
  } as unknown as WASocket;
}

describe("WhatsApp contextual and media sender", () => {
  beforeEach(async () => {
    await resetOutboundPolicyState();
    await resetRecipientStoreForTest();
    resetAccountHealthForTest();
    resetMessageStatusStoreForTest();
    resetRecipientLookupCacheForTest();
    resetRecentInboundStoreForTest();
    await allowRecipientJid(recipientJid);
  });

  afterEach(async () => {
    await resetOutboundPolicyState();
    await resetRecipientStoreForTest();
    resetAccountHealthForTest();
    resetMessageStatusStoreForTest();
    resetRecipientLookupCacheForTest();
    resetRecentInboundStoreForTest();
  });

  it("quotes only a recent inbound message from the same recipient", async () => {
    const inbound = {
      key: { id: "provider-inbound", remoteJid: recipientJid, fromMe: false },
      message: { conversation: "hello" },
    } as WAMessage;
    rememberRecentInboundMessage("in_recent", recipient, inbound);

    const sendMessage = vi.fn(async () => ({ key: { id: "provider-reply" } }));
    const socket = connectedSocket(sendMessage);
    const sender = createWhatsAppSender({
      getSocket: () => socket,
      getConnectionStatus: () => "connected",
    });

    await sender.sendText(recipient, "reply", {
      messageId: "trace-reply",
      replyToMessageId: "in_recent",
    });

    expect(sendMessage).toHaveBeenCalledWith(recipientJid, { text: "reply" }, { quoted: inbound });
  });

  it("rejects unavailable or cross-recipient reply context before transport submission", async () => {
    const inbound = {
      key: { id: "provider-inbound", remoteJid: recipientJid, fromMe: false },
      message: { conversation: "hello" },
    } as WAMessage;
    rememberRecentInboundMessage("in_other", "6280000000000", inbound);

    const sendMessage = vi.fn();
    const socket = connectedSocket(sendMessage);
    const sender = createWhatsAppSender({
      getSocket: () => socket,
      getConnectionStatus: () => "connected",
    });

    await expect(
      sender.sendText(recipient, "reply", {
        messageId: "trace-invalid-context",
        replyToMessageId: "in_other",
      }),
    ).rejects.toMatchObject({ code: "MESSAGE_CONTEXT_UNAVAILABLE" });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("submits binary media content without fetching a remote media URL", async () => {
    const sendMessage = vi.fn(async () => ({ key: { id: "provider-media" } }));
    const socket = connectedSocket(sendMessage);
    const sender = createWhatsAppSender({
      getSocket: () => socket,
      getConnectionStatus: () => "connected",
    });
    const data = Buffer.from("image-bytes");

    await sender.sendMedia(
      recipient,
      { kind: "image", data, mimetype: "image/png", caption: "proof" },
      { messageId: "trace-media" },
    );

    expect(sendMessage).toHaveBeenCalledWith(
      recipientJid,
      { image: data, mimetype: "image/png", caption: "proof" },
      undefined,
    );
  });
});
