import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enqueueMessageDeliveryWebhookDurably: vi.fn(() => true),
  wakeWebhookDeliveryWorker: vi.fn(() => undefined),
  recordActivity: vi.fn(async () => undefined),
}));

vi.mock("../webhooks/index.js", () => ({
  enqueueMessageDeliveryWebhookDurably: mocks.enqueueMessageDeliveryWebhookDurably,
  wakeWebhookDeliveryWorker: mocks.wakeWebhookDeliveryWorker,
}));

vi.mock("../activity/store.js", () => ({
  recordActivity: mocks.recordActivity,
}));

import {
  getMessageStatus,
  getMessageStatusByProviderId,
  markMessageSubmitted,
  markMessageSubmitting,
  prepareMessageStatus,
  resetMessageStatusStoreForTest,
  updateMessageDeliveryEvidence,
  updateMessageStatus,
} from "./message-status-store.js";

function seedSubmittedMessage(input: {
  id: string;
  providerMessageId: string;
  to: string;
  recipientJid?: string;
}): void {
  prepareMessageStatus({
    id: input.id,
    to: input.to,
    ...(input.recipientJid ? { recipientJid: input.recipientJid } : {}),
  });
  markMessageSubmitting(input.id);
  markMessageSubmitted(input.id, input.providerMessageId);
}

describe("durable message status store", () => {
  afterEach(() => {
    resetMessageStatusStoreForTest();
    mocks.enqueueMessageDeliveryWebhookDurably.mockReset();
    mocks.enqueueMessageDeliveryWebhookDurably.mockReturnValue(true);
    mocks.wakeWebhookDeliveryWorker.mockClear();
    mocks.recordActivity.mockClear();
  });

  it("persists canonical and provider correlation without message content", () => {
    seedSubmittedMessage({
      id: "trace-1",
      providerMessageId: "provider-1",
      to: "6281234567890@s.whatsapp.net",
      recipientJid: "6281234567890@s.whatsapp.net",
    });

    const byCanonicalId = getMessageStatus("trace-1");
    const byProviderId = getMessageStatusByProviderId("provider-1");

    expect(byCanonicalId).toMatchObject({
      id: "trace-1",
      providerMessageId: "provider-1",
      status: "pending",
      deliveryEvidence: "submitted",
    });
    expect(byProviderId?.id).toBe("trace-1");
    expect(byCanonicalId).not.toHaveProperty("text");
  });

  it("enqueues accepted exactly once when a pending message becomes accepted", () => {
    seedSubmittedMessage({
      id: "trace-1",
      providerMessageId: "provider-1",
      to: "6281234567890@s.whatsapp.net",
    });

    updateMessageStatus("trace-1", { status: "accepted" });
    updateMessageStatus("trace-1", { status: "accepted" });

    expect(getMessageStatus("trace-1")?.status).toBe("accepted");
    expect(mocks.enqueueMessageDeliveryWebhookDurably).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueMessageDeliveryWebhookDurably).toHaveBeenCalledWith({
      messageId: "trace-1",
      status: "accepted",
    });
    expect(mocks.wakeWebhookDeliveryWorker).toHaveBeenCalledTimes(1);
  });

  it("rolls back the message transition when the webhook outbox cannot persist", () => {
    seedSubmittedMessage({
      id: "trace-outbox-failure",
      providerMessageId: "provider-outbox-failure",
      to: "6281234567890@s.whatsapp.net",
    });
    mocks.enqueueMessageDeliveryWebhookDurably.mockImplementationOnce(() => {
      throw new Error("outbox unavailable");
    });

    expect(() => updateMessageStatus("trace-outbox-failure", { status: "accepted" })).toThrow("outbox unavailable");
    expect(getMessageStatus("trace-outbox-failure")).toMatchObject({
      status: "pending",
      dispatchState: "submitted",
    });
    expect(mocks.wakeWebhookDeliveryWorker).not.toHaveBeenCalled();
  });

  it("promotes delivery evidence monotonically and emits each richer evidence once", () => {
    seedSubmittedMessage({
      id: "trace-evidence",
      providerMessageId: "provider-evidence",
      to: "6281234567890@s.whatsapp.net",
    });
    updateMessageStatus("trace-evidence", { status: "accepted" });
    updateMessageDeliveryEvidence("trace-evidence", "server_accepted", new Date("2026-09-05T00:00:00.000Z"));
    updateMessageDeliveryEvidence("trace-evidence", "delivered", new Date("2026-09-05T00:00:05.000Z"));
    updateMessageDeliveryEvidence("trace-evidence", "read", new Date("2026-09-05T00:00:10.000Z"));
    updateMessageDeliveryEvidence("trace-evidence", "delivered", new Date("2026-09-05T00:00:20.000Z"));

    expect(getMessageStatus("trace-evidence")).toMatchObject({
      status: "accepted",
      deliveryEvidence: "read",
      serverAcceptedAt: "2026-09-05T00:00:00.000Z",
      deliveredAt: "2026-09-05T00:00:05.000Z",
      readAt: "2026-09-05T00:00:10.000Z",
    });
    expect(mocks.enqueueMessageDeliveryWebhookDurably).toHaveBeenCalledWith({
      messageId: "trace-evidence",
      status: "accepted",
    });
    expect(mocks.enqueueMessageDeliveryWebhookDurably).toHaveBeenCalledWith({
      messageId: "trace-evidence",
      status: "delivered",
    });
    expect(mocks.enqueueMessageDeliveryWebhookDurably).toHaveBeenCalledWith({
      messageId: "trace-evidence",
      status: "read",
    });
    expect(mocks.enqueueMessageDeliveryWebhookDurably).toHaveBeenCalledTimes(3);
  });

  it("does not allow a terminal message state to be reversed", () => {
    seedSubmittedMessage({
      id: "trace-2",
      providerMessageId: "provider-2",
      to: "6281234567890@s.whatsapp.net",
    });

    updateMessageStatus("trace-2", {
      status: "rejected",
      error: "REACHOUT_RESTRICTED",
      message: "Outbound rejected",
    });
    updateMessageStatus("trace-2", { status: "accepted" });

    expect(getMessageStatus("trace-2")).toMatchObject({
      status: "rejected",
      error: "REACHOUT_RESTRICTED",
      message: "Outbound rejected",
    });
    expect(mocks.enqueueMessageDeliveryWebhookDurably).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueMessageDeliveryWebhookDurably).toHaveBeenCalledWith({
      messageId: "trace-2",
      status: "rejected",
      error: "REACHOUT_RESTRICTED",
    });
  });
});
