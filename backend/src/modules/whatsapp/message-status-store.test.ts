import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enqueueMessageDeliveryWebhook: vi.fn(() => undefined),
  recordActivity: vi.fn(async () => undefined),
}));

vi.mock("../../webhooks/delivery-webhook.js", () => ({
  enqueueMessageDeliveryWebhook: mocks.enqueueMessageDeliveryWebhook,
}));

vi.mock("../../activity/store.js", () => ({
  recordActivity: mocks.recordActivity,
}));

import { rememberMessageStatus, resetMessageStatusStoreForTest, updateMessageStatus } from "./message-status-store.js";

describe("message status webhook integration", () => {
  afterEach(() => {
    resetMessageStatusStoreForTest();
    mocks.enqueueMessageDeliveryWebhook.mockClear();
    mocks.recordActivity.mockClear();
  });

  it("enqueues accepted exactly once when a pending message becomes accepted", () => {
    rememberMessageStatus({
      id: "message-1",
      to: "6281234567890@s.whatsapp.net",
      status: "pending",
      updatedAt: "2026-08-12T14:00:00.000Z",
    });

    updateMessageStatus("message-1", { status: "accepted" });
    updateMessageStatus("message-1", { status: "accepted" });

    expect(mocks.enqueueMessageDeliveryWebhook).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueMessageDeliveryWebhook).toHaveBeenCalledWith({
      messageId: "message-1",
      status: "accepted",
    });
  });

  it("enqueues rejected with the normalized error code", () => {
    rememberMessageStatus({
      id: "message-2",
      to: "6281234567890@s.whatsapp.net",
      status: "pending",
      updatedAt: "2026-08-12T14:00:00.000Z",
    });

    updateMessageStatus("message-2", {
      status: "rejected",
      error: "REACHOUT_RESTRICTED",
      message: "Outbound rejected",
    });

    expect(mocks.enqueueMessageDeliveryWebhook).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueMessageDeliveryWebhook).toHaveBeenCalledWith({
      messageId: "message-2",
      status: "rejected",
      error: "REACHOUT_RESTRICTED",
    });
  });
});
