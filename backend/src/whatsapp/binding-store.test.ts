import { existsSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { config } from "../config/index.js";
import { bindWhatsAppAccount, clearWhatsAppBinding, getWhatsAppBinding } from "./binding-store.js";

const bindingFile = resolve(config.dataDirectory, "whatsapp-binding.json");

afterEach(() => {
  clearWhatsAppBinding();
  rmSync(`${bindingFile}.corrupt`, { force: true });
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

  it("quarantines a corrupt binding and lets Baileys rebuild it", () => {
    clearWhatsAppBinding();
    writeFileSync(bindingFile, "{broken-json", { mode: 0o600 });

    expect(getWhatsAppBinding()).toEqual({
      state: "unbound",
      jid: null,
      phone: null,
      boundAt: null,
    });
    expect(existsSync(bindingFile)).toBe(false);
    expect(existsSync(`${bindingFile}.corrupt`)).toBe(true);

    expect(bindWhatsAppAccount("6281234567890:3@s.whatsapp.net")).toMatchObject({
      state: "bound",
      phone: "6281234567890",
    });
  });
});
