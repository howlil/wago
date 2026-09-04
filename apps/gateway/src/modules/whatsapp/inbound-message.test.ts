import type { WAMessage } from "@whiskeysockets/baileys";
import { describe, expect, it } from "vitest";
import { normalizeInboundMediaMessage, normalizeInboundTextMessage } from "./inbound-message.js";

function message(input: Partial<WAMessage> & { key: WAMessage["key"] }): WAMessage {
  return input as WAMessage;
}

describe("inbound message normalization", () => {
  const now = () => new Date("2026-09-02T00:00:00.000Z");

  it("normalizes a direct incoming text into a stable Wago message id", () => {
    const input = message({
      key: { id: "provider-1", remoteJid: "6281234567890@s.whatsapp.net", fromMe: false },
      message: { conversation: "hello" },
    });

    const first = normalizeInboundTextMessage(input, now);
    const second = normalizeInboundTextMessage(input, now);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      from: "6281234567890",
      text: "hello",
      receivedAt: "2026-09-02T00:00:00.000Z",
    });
    expect(first?.messageId).toMatch(/^in_[a-f0-9]{32}$/);
  });

  it("retains only the provider quote reference for internal canonical mapping", () => {
    const result = normalizeInboundTextMessage(
      message({
        key: { id: "provider-quoted", remoteJid: "6281234567890@s.whatsapp.net", fromMe: false },
        message: {
          extendedTextMessage: {
            text: "reply",
            contextInfo: { stanzaId: "provider-outbound" },
          },
        },
      }),
      now,
    );

    expect(result).toMatchObject({
      text: "reply",
      quotedProviderMessageId: "provider-outbound",
    });
  });

  it("normalizes supported direct media as metadata without downloading bytes", () => {
    const result = normalizeInboundMediaMessage(
      message({
        key: { id: "provider-image", remoteJid: "6281234567890@s.whatsapp.net", fromMe: false },
        message: {
          imageMessage: {
            url: "https://example.invalid/image",
            mimetype: "image/jpeg",
            caption: "proof",
            fileLength: 1234,
            width: 640,
            height: 480,
            contextInfo: { stanzaId: "provider-outbound" },
          },
        },
      }),
      now,
    );

    expect(result).toMatchObject({
      from: "6281234567890",
      quotedProviderMessageId: "provider-outbound",
      media: {
        kind: "image",
        mimetype: "image/jpeg",
        caption: "proof",
        fileLength: 1234,
        width: 640,
        height: 480,
      },
    });
    expect(result).not.toHaveProperty("data");
  });

  it("keeps the logical message id stable across device-suffixed phone JIDs", () => {
    const plain = normalizeInboundTextMessage(
      message({
        key: { id: "provider-device", remoteJid: "6281234567890@s.whatsapp.net", fromMe: false },
        message: { conversation: "same message" },
      }),
      now,
    );
    const device = normalizeInboundTextMessage(
      message({
        key: { id: "provider-device", remoteJid: "6281234567890:7@s.whatsapp.net", fromMe: false },
        message: { conversation: "same message" },
      }),
      now,
    );

    expect(device?.messageId).toBe(plain?.messageId);
    expect(device?.from).toBe("6281234567890");
  });

  it("uses the phone-number alternate jid when Baileys addresses the chat by LID", () => {
    const result = normalizeInboundTextMessage(
      message({
        key: {
          id: "provider-lid",
          remoteJid: "123456789@lid",
          remoteJidAlt: "628111222333@s.whatsapp.net",
          fromMe: false,
        },
        message: { extendedTextMessage: { text: "from lid" } },
      }),
      now,
    );

    expect(result?.from).toBe("628111222333");
    expect(result?.text).toBe("from lid");
  });

  it("ignores outgoing, group, broadcast, empty, and unsupported content", () => {
    expect(
      normalizeInboundTextMessage(
        message({
          key: { id: "out", remoteJid: "6281234567890@s.whatsapp.net", fromMe: true },
          message: { conversation: "outgoing" },
        }),
        now,
      ),
    ).toBeNull();

    expect(
      normalizeInboundTextMessage(
        message({
          key: { id: "group", remoteJid: "12345@g.us", fromMe: false },
          message: { conversation: "group" },
        }),
        now,
      ),
    ).toBeNull();

    expect(
      normalizeInboundMediaMessage(
        message({
          key: { id: "status", remoteJid: "status@broadcast", fromMe: false },
          message: { imageMessage: { url: "https://example.invalid/status" } },
        }),
        now,
      ),
    ).toBeNull();

    expect(
      normalizeInboundTextMessage(
        message({
          key: { id: "empty", remoteJid: "6281234567890@s.whatsapp.net", fromMe: false },
          message: { conversation: "   " },
        }),
        now,
      ),
    ).toBeNull();
  });
});
