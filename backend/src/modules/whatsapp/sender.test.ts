import type { WASocket } from "@whiskeysockets/baileys";
import { describe, expect, it } from "vitest";
import { createWhatsAppSender } from "./sender.js";

const fakeSocket = {} as WASocket;

describe("WhatsApp sender", () => {
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
});
