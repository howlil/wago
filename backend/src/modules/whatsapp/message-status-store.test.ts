import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enqueueMessageDeliveryWebhook: vi.fn(() => undefined),
  recordActivity: vi.fn(async () => undefined),
}));

vi.mock("../webhooks/delivery-webhook.js", () => ({
  enqueueMessageDeliveryWebhook: mocks.enqueueMessageDeliveryWebhook,
}));

vi.mock("../activity/store.js", () => ({
  recordActivity: mocks.recordActivity,
}));

import {
  getMessageStatus,
  rememberMessageStatus,
  resetMessageStatusStoreForTest,
  updateMessageStatus,
} from "./message-status-store.js";

describe("message status lifecycle", () => {
  afterEach(() => {
    resetMessageStatusStoreForTest();
    mocks.enqueueMessageDeliveryWebhook.mockClear();
    mocks.recordActivity.mockClear();
  });

  it("emits each forward delivery transition exactly once", () => {
    rememberMessageStatus({
      id: "message-1",
      to: "6281234567890@s.whatsapp.net",
      status: "pending",
      updatedAt: "2026-08-12T14:00:00.000Z",
    });

    updateMessageStatus("message-1", { status: "accepted" });
    updateMessageStatus("message-1", { status: "accepted" });
    updateMessageStatus("message-1", { status: "delivered" });
    updateMessageStatus("message-1", { status: "delivered" });
    updateMessageStatus("message-1", { status: "read" });
    updateMessageStatus("message-1", { status: "read" });

    expect(mocks.enqueueMessageDeliveryWebhook.mock.calls).toEqual([
      [{ messageId: "message-1", status: "accepted" }],
      [{ messageId: "message-1", status: "delivered" }],
      [{ messageId: "message-1", status: "read" }],
    ]);
    expect(getMessageStatus("message-1")?.status).toBe("read");
  });

  it("allows a higher receipt to skip missing intermediate acknowledgements", () => {
    rememberMessageStatus({
      id: "message-2",
      to: "6281234567890@s.whatsapp.net",
      status: "pending",
      updatedAt: "2026-08-12T14:00:00.000Z",
    });

    updateMessageStatus("message-2", { status: "delivered" });

    expect(getMessageStatus("message-2")?.status).toBe("delivered");
    expect(mocks.enqueueMessageDeliveryWebhook).toHaveBeenCalledWith({
      messageId: "message-2",
      status: "delivered",
    });
  });

  it("ignores late lower receipts and rejection after delivery", () => {
    rememberMessageStatus({
      id: "message-3",
      to: "6281234567890@s.whatsapp.net",
      status: "pending",
      updatedAt: "2026-08-12T14:00:00.000Z",
    });

    updateMessageStatus("message-3", { status: "delivered" });
    updateMessageStatus("message-3", { status: "accepted" });
    updateMessageStatus("message-3", { status: "rejected", error: "MESSAGE_REJECTED" });
    updateMessageStatus("message-3", { status: "read" });
    updateMessageStatus("message-3", { status: "delivered" });

    expect(getMessageStatus("message-3")?.status).toBe("read");
    expect(mocks.enqueueMessageDeliveryWebhook.mock.calls).toEqual([
      [{ messageId: "message-3", status: "delivered" }],
      [{ messageId: "message-3", status: "read" }],
    ]);
  });

  it("keeps rejection terminal when WhatsApp rejects before delivery", () => {
    rememberMessageStatus({
      id: "message-4",
      to: "6281234567890@s.whatsapp.net",
      status: "pending",
      updatedAt: "2026-08-12T14:00:00.000Z",
    });

    updateMessageStatus("message-4", { status: "accepted" });
    updateMessageStatus("message-4", {
      status: "rejected",
      error: "REACHOUT_RESTRICTED",
      message: "Outbound rejected",
    });
    updateMessageStatus("message-4", { status: "delivered" });

    expect(getMessageStatus("message-4")).toMatchObject({
      status: "rejected",
      error: "REACHOUT_RESTRICTED",
    });
    expect(mocks.enqueueMessageDeliveryWebhook).toHaveBeenLastCalledWith({
      messageId: "message-4",
      status: "rejected",
      error: "REACHOUT_RESTRICTED",
    });
  });
});
