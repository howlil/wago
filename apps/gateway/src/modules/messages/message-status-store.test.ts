import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enqueueMessageDeliveryWebhook: vi.fn(() => undefined),
  recordActivity: vi.fn(async () => undefined),
}));

vi.mock("../webhooks/index.js", () => ({
  enqueueMessageDeliveryWebhook: mocks.enqueueMessageDeliveryWebhook,
}));

vi.mock("../activity/store.js", () => ({
  recordActivity: mocks.recordActivity,
}));

import {
  getMessageStatus,
  getMessageStatusByProviderId,
  rememberPendingMessageStatus,
  resetMessageStatusStoreForTest,
  updateMessageDeliveryEvidence,
  updateMessageStatus,
} from "./message-status-store.js";

describe("durable message status store", () => {
  afterEach(() => {
    resetMessageStatusStoreForTest();
    mocks.enqueueMessageDeliveryWebhook.mockClear();
    mocks.recordActivity.mockClear();
  });

  it("persists canonical and provider correlation without message content", () => {
    rememberPendingMessageStatus({
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
    rememberPendingMessageStatus({
      id: "trace-1",
      providerMessageId: "provider-1",
      to: "6281234567890@s.whatsapp.net",
    });

    updateMessageStatus("trace-1", { status: "accepted" });
    updateMessageStatus("trace-1", { status: "accepted" });

    expect(getMessageStatus("trace-1")?.status).toBe("accepted");
    expect(mocks.enqueueMessageDeliveryWebhook).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueMessageDeliveryWebhook).toHaveBeenCalledWith({
      messageId: "trace-1",
      status: "accepted",
    });
  });

  it("promotes delivery evidence monotonically and emits each richer evidence once", () => {
    rememberPendingMessageStatus({
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
    expect(mocks.enqueueMessageDeliveryWebhook).toHaveBeenCalledWith({
      messageId: "trace-evidence",
      status: "accepted",
    });
    expect(mocks.enqueueMessageDeliveryWebhook).toHaveBeenCalledWith({
      messageId: "trace-evidence",
      status: "delivered",
    });
    expect(mocks.enqueueMessageDeliveryWebhook).toHaveBeenCalledWith({
      messageId: "trace-evidence",
      status: "read",
    });
    expect(mocks.enqueueMessageDeliveryWebhook).toHaveBeenCalledTimes(3);
  });

  it("does not allow a terminal message state to be reversed", () => {
    rememberPendingMessageStatus({
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
    expect(mocks.enqueueMessageDeliveryWebhook).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueMessageDeliveryWebhook).toHaveBeenCalledWith({
      messageId: "trace-2",
      status: "rejected",
      error: "REACHOUT_RESTRICTED",
    });
  });
});
