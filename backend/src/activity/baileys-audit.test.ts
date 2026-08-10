import { afterEach, describe, expect, it } from "vitest";
import { listAudit } from "./query.js";
import { recordBaileysAudit, sanitizeBaileysMetadata } from "./baileys-audit.js";
import { resetActivityLogForTest } from "./store.js";

describe("Baileys audit sanitizer", () => {
  afterEach(async () => {
    await resetActivityLogForTest();
  });

  it("drops protocol secrets, masks identifiers, and keeps safe primitives", () => {
    expect(
      sanitizeBaileysMetadata({
        socketGeneration: 4,
        statusCode: 401,
        terminal: true,
        reconnect: false,
        accountJid: "6281234567890@s.whatsapp.net",
        targetPhone: "6281234567890",
        qr: "secret-qr",
        text: "secret-message",
        messageId: "secret-message-id",
        token: "secret-token",
        credentialBlob: "secret-credential",
        signalKey: "secret-key",
        authorization: "Bearer secret",
        payload: { nested: "raw" },
        arrayPayload: ["raw"],
      }),
    ).toEqual({
      socketGeneration: 4,
      statusCode: 401,
      terminal: true,
      reconnect: false,
      accountJid: "62812***890@s.whatsapp.net",
      targetPhone: "62812***890",
    });
  });

  it("omits nested values and undefined metadata", () => {
    expect(
      sanitizeBaileysMetadata({
        reason: "logged_out",
        reconnectAttempt: 2,
        retryAt: null,
        optional: undefined,
        nested: { safe: true },
        list: [1, 2, 3],
      }),
    ).toEqual({
      reason: "logged_out",
      reconnectAttempt: 2,
      retryAt: null,
    });
  });

  it("records all adapter events with source baileys", async () => {
    await recordBaileysAudit({
      level: "warning",
      category: "connection",
      code: "baileys.connection.close",
      title: "WhatsApp connection closed",
      description: "The linked session closed.",
      metadata: {
        statusCode: 401,
        reason: "logged_out",
      },
    });

    const page = await listAudit({ limit: 10, source: "baileys" });
    expect(page.events).toHaveLength(1);
    expect(page.events[0]).toMatchObject({
      source: "baileys",
      code: "baileys.connection.close",
      metadata: {
        statusCode: 401,
        reason: "logged_out",
      },
    });
  });
});
