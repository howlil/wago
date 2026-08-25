import type { WASocket } from "@whiskeysockets/baileys";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rememberRecipientResolution: vi.fn(),
}));

vi.mock("../recipients/store.js", () => ({
  rememberRecipientResolution: mocks.rememberRecipientResolution,
}));

import { resetRecipientLookupCacheForTest, resolveRecipientJid } from "./recipient-cache.js";

function createSocket(onWhatsApp: WASocket["onWhatsApp"]): WASocket {
  return { onWhatsApp } as WASocket;
}

describe("recipient resolution", () => {
  beforeEach(() => {
    resetRecipientLookupCacheForTest();
    mocks.rememberRecipientResolution.mockReset();
  });

  it("resolves and remembers the canonical WhatsApp JID", async () => {
    const onWhatsApp = vi.fn().mockResolvedValue([
      { exists: true, jid: "6281234567890@s.whatsapp.net" },
    ]) as unknown as WASocket["onWhatsApp"];
    const socket = createSocket(onWhatsApp);

    await expect(resolveRecipientJid(socket, "6281234567890@s.whatsapp.net")).resolves.toBe(
      "6281234567890@s.whatsapp.net",
    );
    expect(mocks.rememberRecipientResolution).toHaveBeenCalledWith(
      "6281234567890@s.whatsapp.net",
      "6281234567890@s.whatsapp.net",
    );

    await resolveRecipientJid(socket, "6281234567890@s.whatsapp.net");
    expect(onWhatsApp).toHaveBeenCalledTimes(1);
  });

  it("rejects recipients that WhatsApp reports as unavailable", async () => {
    const onWhatsApp = vi.fn().mockResolvedValue([]) as unknown as WASocket["onWhatsApp"];
    const socket = createSocket(onWhatsApp);

    await expect(resolveRecipientJid(socket, "6280000000000@s.whatsapp.net")).rejects.toMatchObject({
      name: "ApplicationError",
      code: "RECIPIENT_NOT_ON_WHATSAPP",
    });

    await expect(resolveRecipientJid(socket, "6280000000000@s.whatsapp.net")).rejects.toMatchObject({
      code: "RECIPIENT_NOT_ON_WHATSAPP",
    });
    expect(onWhatsApp).toHaveBeenCalledTimes(1);
  });

  it("classifies transient Baileys lookup failures separately from invalid recipients", async () => {
    const onWhatsApp = vi.fn().mockRejectedValue(new Error("upstream unavailable")) as unknown as WASocket["onWhatsApp"];
    const socket = createSocket(onWhatsApp);

    await expect(resolveRecipientJid(socket, "6281234567890@s.whatsapp.net")).rejects.toMatchObject({
      name: "ApplicationError",
      code: "RECIPIENT_LOOKUP_FAILED",
    });
  });
});
