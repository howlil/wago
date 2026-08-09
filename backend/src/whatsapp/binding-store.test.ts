import { afterEach, describe, expect, it } from "vitest";
import { bindWhatsAppAccount, clearWhatsAppBinding, getWhatsAppBinding } from "./binding-store.js";

afterEach(() => {
  clearWhatsAppBinding();
});

describe("WhatsApp binding store", () => {
  it("returns an explicit unbound state before a WhatsApp account is paired", () => {
    clearWhatsAppBinding();

    expect(getWhatsAppBinding()).toEqual({
      state: "unbound",
      jid: null,
      phone: null,
      boundAt: null,
    });
  });

  it("persists and normalizes the account bound by Baileys", () => {
    clearWhatsAppBinding();

    const binding = bindWhatsAppAccount("6281234567890:7@s.whatsapp.net");

    expect(binding).toMatchObject({
      state: "bound",
      jid: "6281234567890@s.whatsapp.net",
      phone: "6281234567890",
    });
    expect(binding.boundAt).toEqual(expect.any(String));
    expect(getWhatsAppBinding()).toEqual(binding);
  });

  it("keeps the original boundAt timestamp while reconnecting the same account", () => {
    clearWhatsAppBinding();

    const first = bindWhatsAppAccount("6281234567890:1@s.whatsapp.net");
    const second = bindWhatsAppAccount("6281234567890:9@s.whatsapp.net");

    expect(second.boundAt).toBe(first.boundAt);
  });
});
