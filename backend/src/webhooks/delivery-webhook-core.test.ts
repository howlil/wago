import { describe, expect, it, vi } from "vitest";
import { createDeliveryWebhookDispatcher } from "./delivery-webhook-core.js";

type CapturedRequest = {
  url: string;
  init: RequestInit;
};

function response(status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
  };
}

describe("delivery webhook dispatcher", () => {
  it("sends a signed accepted event", async () => {
    const requests: CapturedRequest[] = [];
    const dispatcher = createDeliveryWebhookDispatcher({
      url: "https://consumer.example/webhooks/wago",
      secret: "test-secret",
      fetchImpl: async (url, init) => {
        requests.push({ url, init });
        return response(204);
      },
      now: () => new Date("2026-08-12T14:00:00.000Z"),
      createDeliveryId: () => "delivery-1",
      retryDelaysMs: [0],
    });

    await dispatcher.dispatch({
      messageId: "message-1",
      status: "accepted",
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://consumer.example/webhooks/wago");
    expect(requests[0]?.init.method).toBe("POST");
    expect(requests[0]?.init.body).toBe(
      '{"id":"delivery-1","event":"message.accepted","createdAt":"2026-08-12T14:00:00.000Z","data":{"messageId":"message-1","status":"accepted"}}',
    );
    expect(requests[0]?.init.headers).toEqual({
      "Content-Type": "application/json",
      "X-Wago-Event": "message.accepted",
      "X-Wago-Delivery": "delivery-1",
      "X-Wago-Signature": "sha256=f33fdc870e055c8751e1347995125545c054623e63cbbac6c8f42dc0cd845366",
    });
  });

  it("retries retryable failures with bounded backoff", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(response(500)).mockResolvedValueOnce(response(204));
    const slept: number[] = [];
    const dispatcher = createDeliveryWebhookDispatcher({
      url: "https://consumer.example/webhooks/wago",
      secret: "test-secret",
      fetchImpl,
      sleep: async (delayMs) => {
        slept.push(delayMs);
      },
      retryDelaysMs: [0, 5_000, 30_000],
      createDeliveryId: () => "delivery-2",
    });

    await dispatcher.dispatch({ messageId: "message-2", status: "accepted" });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(slept).toEqual([5_000]);
  });

  it("does not retry non-retryable client errors", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(401));
    const sleep = vi.fn(async () => undefined);
    const dispatcher = createDeliveryWebhookDispatcher({
      url: "https://consumer.example/webhooks/wago",
      secret: "test-secret",
      fetchImpl,
      sleep,
      retryDelaysMs: [0, 5_000, 30_000],
      createDeliveryId: () => "delivery-3",
    });

    await dispatcher.dispatch({ messageId: "message-3", status: "rejected", error: "MESSAGE_REJECTED" });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("is a no-op when webhook configuration is disabled", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(204));
    const dispatcher = createDeliveryWebhookDispatcher({
      url: null,
      secret: null,
      fetchImpl,
    });

    await dispatcher.dispatch({ messageId: "message-4", status: "accepted" });

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
