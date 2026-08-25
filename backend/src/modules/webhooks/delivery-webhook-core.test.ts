import { describe, expect, it, vi } from "vitest";
import {
  createMessageDeliveryWebhookEnvelope,
  createWebhookAttemptSender,
  serializeWebhookEnvelope,
} from "./delivery-webhook-core.js";

function response(status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
  };
}

describe("delivery webhook signing and attempts", () => {
  it("signs delivery id, timestamp, and raw body with current and previous secrets", async () => {
    const envelope = createMessageDeliveryWebhookEnvelope(
      { messageId: "message-1", status: "accepted" },
      {
        createDeliveryId: () => "delivery-1",
        now: () => new Date("2026-08-12T14:00:00.000Z"),
      },
    );
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.body).toBe(
        '{"version":"1","id":"delivery-1","event":"message.server_accepted","createdAt":"2026-08-12T14:00:00.000Z","data":{"messageId":"message-1","status":"accepted"}}',
      );
      expect(init.headers).toEqual({
        "Content-Type": "application/json",
        "User-Agent": "Wago-Webhooks/1.0",
        "Webhook-Id": "delivery-1",
        "Webhook-Timestamp": "1786543200",
        "Webhook-Signature":
          "v1,L0MhjGhF8ddRstR/kOr7GzPnRPy6Y5FXRkAXfY19mbE= v1,OTSgtW7SQxVumFUhGmY3/PFQ0Z58l8iuVvKD8Ns3k9g=",
        "X-Wago-Delivery": "delivery-1",
        "X-Wago-Event": "message.server_accepted",
      });
      expect(init.redirect).toBe("manual");
      return response(204);
    });
    const sender = createWebhookAttemptSender({
      url: "https://consumer.example/webhooks/wago",
      secrets: ["a".repeat(32), "b".repeat(32)],
      fetchImpl,
      now: () => new Date("2026-08-12T14:00:00.000Z"),
    });

    const result = await sender.send({
      id: envelope.id,
      event: envelope.event,
      payloadJson: serializeWebhookEnvelope(envelope),
    });

    expect(result).toEqual({ ok: true, statusCode: 204 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["accepted", "message.server_accepted"],
    ["delivered", "message.delivered"],
    ["read", "message.read"],
    ["rejected", "message.rejected"],
  ] as const)("maps %s status to %s event", (status, event) => {
    expect(
      createMessageDeliveryWebhookEnvelope(
        { messageId: "message-2", status },
        {
          createDeliveryId: () => "delivery-2",
          now: () => new Date("2026-08-12T14:00:00.000Z"),
        },
      ),
    ).toMatchObject({
      event,
      data: { messageId: "message-2", status },
    });
  });

  it("classifies retryable HTTP failures without retrying in the request sender", async () => {
    const sender = createWebhookAttemptSender({
      url: "https://consumer.example/webhooks/wago",
      secrets: ["a".repeat(32)],
      fetchImpl: async () => response(503),
    });

    await expect(
      sender.send({
        id: "delivery-2",
        event: "message.rejected",
        payloadJson: "{}",
      }),
    ).resolves.toEqual({
      ok: false,
      retryable: true,
      statusCode: 503,
      errorCode: "WEBHOOK_HTTP_SERVER_ERROR",
    });
  });

  it("treats redirects and ordinary 4xx responses as permanent failures", async () => {
    for (const [status, errorCode] of [
      [302, "WEBHOOK_REDIRECT_REJECTED"],
      [401, "WEBHOOK_HTTP_CLIENT_ERROR"],
    ] as const) {
      const sender = createWebhookAttemptSender({
        url: "https://consumer.example/webhooks/wago",
        secrets: ["a".repeat(32)],
        fetchImpl: async () => response(status),
      });

      await expect(
        sender.send({ id: `delivery-${status}`, event: "message.rejected", payloadJson: "{}" }),
      ).resolves.toEqual({
        ok: false,
        retryable: false,
        statusCode: status,
        errorCode,
      });
    }
  });
});
