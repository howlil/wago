import { describe, expect, it } from "vitest";
import { config } from "../config.js";
import { normalizePhone, toWhatsAppJid } from "./phone.js";

describe("normalizePhone", () => {
  it("removes spaces, hyphens, and plus signs", () => {
    expect(normalizePhone("+62 812-3456-7890")).toBe("6281234567890");
  });

  it("replaces a leading local zero with the configured default country code", () => {
    const originalCountryCode = config.defaultCountryCode;
    config.defaultCountryCode = "60";

    expect(normalizePhone("012 3456 7890")).toBe("601234567890");

    config.defaultCountryCode = originalCountryCode;
  });

  it("defaults local Indonesian numbers to country code 62", () => {
    expect(normalizePhone("0812 3456 7890")).toBe("6281234567890");
  });
});

describe("toWhatsAppJid", () => {
  it("builds a WhatsApp user JID from a normalized phone number", () => {
    expect(toWhatsAppJid("0812-3456-7890")).toBe("6281234567890@s.whatsapp.net");
  });

  it("rejects ambiguous phone input after normalization", () => {
    expect(() => toWhatsAppJid("0812abc")).toThrow("Phone number must contain digits only");
  });
});
