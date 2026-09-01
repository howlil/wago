import { describe, expect, it } from "vitest";
import { maskIdentifier, redactLogFields } from "./logger.js";

describe("maskIdentifier", () => {
  it("masks phone numbers while preserving useful shape", () => {
    expect(maskIdentifier("6281234567890")).toBe("62812***890");
  });

  it("masks WhatsApp JIDs without removing the domain", () => {
    expect(maskIdentifier("6281234567890@s.whatsapp.net")).toBe("62812***890@s.whatsapp.net");
  });
});

describe("redactLogFields", () => {
  it("redacts secrets, message payloads, QR values, auth paths, and full identifiers", () => {
    const redacted = redactLogFields({
      apiKey: "wa_secret",
      text: "hello",
      qr: "qr-payload",
      authDirectory: "/app/data/auth",
      recipientJid: "6281234567890@s.whatsapp.net",
      nested: {
        phone: "6289999999999",
        ok: true,
      },
    });

    expect(redacted).toEqual({
      apiKey: "[REDACTED]",
      text: "[REDACTED]",
      qr: "[REDACTED]",
      authDirectory: "[REDACTED]",
      recipientJid: "62812***890@s.whatsapp.net",
      nested: {
        phone: "62899***999",
        ok: true,
      },
    });
  });
});
