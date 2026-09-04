import { describe, expect, it } from "vitest";
import {
  createIncomingMediaWebhookEnvelope,
  createIncomingMessageWebhookEnvelope,
  serializeWebhookEnvelope,
} from "./delivery-webhook-core.js";

describe("contextual inbound webhook envelopes", () => {
  const deps = {
    createDeliveryId: () => "delivery-context",
    now: () => new Date("2026-09-05T00:00:01.000Z"),
  };

  it("adds canonical reply context to text without provider identifiers", () => {
    const envelope = createIncomingMessageWebhookEnvelope(
      {
        messageId: "in_1",
        from: "6281234567890",
        text: "reply",
        receivedAt: "2026-09-05T00:00:00.000Z",
        replyToMessageId: "wago-outbound-1",
      },
      deps,
    );

    expect(envelope.data).toMatchObject({
      messageId: "in_1",
      replyToMessageId: "wago-outbound-1",
    });
    expect(serializeWebhookEnvelope(envelope)).not.toContain("provider");
  });

  it("emits incoming media metadata without embedding bytes or a download URL", () => {
    const envelope = createIncomingMediaWebhookEnvelope(
      {
        messageId: "in_media",
        from: "6281234567890",
        receivedAt: "2026-09-05T00:00:00.000Z",
        media: {
          kind: "document",
          mimetype: "application/pdf",
          fileName: "proof.pdf",
          fileLength: 2048,
          caption: "proof",
        },
      },
      deps,
    );

    expect(envelope).toMatchObject({
      event: "message.media_received",
      data: {
        messageId: "in_media",
        media: {
          kind: "document",
          mimetype: "application/pdf",
          fileName: "proof.pdf",
          fileLength: 2048,
        },
      },
    });
    const serialized = serializeWebhookEnvelope(envelope);
    expect(serialized).not.toContain("data:application");
    expect(serialized).not.toContain("https://");
    expect(serialized).not.toContain("bytes");
  });
});
