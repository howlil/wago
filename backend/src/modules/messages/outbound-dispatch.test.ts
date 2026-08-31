import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordActivity: vi.fn(async () => undefined),
}));

vi.mock("../activity/store.js", () => ({
  recordActivity: mocks.recordActivity,
}));

vi.mock("../webhooks/index.js", () => ({
  enqueueMessageDeliveryWebhook: vi.fn(() => undefined),
}));

import { getDatabase } from "../../infrastructure/database.js";
import { getMessageStatus, resetMessageStatusStoreForTest } from "./message-status-store.js";
import {
  abandonOutboundDispatch,
  markOutboundDispatchSubmitted,
  markOutboundDispatchSubmitting,
  prepareOutboundDispatch,
  recoverInterruptedOutboundDispatches,
} from "./outbound-dispatch.js";

const database = getDatabase();

function reservation(messageId: string): { key: string; message_id: string | null } | undefined {
  return database.prepare("SELECT key, message_id FROM idempotency_keys WHERE message_id = ?").get(messageId) as
    | { key: string; message_id: string | null }
    | undefined;
}

describe("crash-safe outbound dispatch", () => {
  afterEach(() => {
    resetMessageStatusStoreForTest();
    database.prepare("DELETE FROM idempotency_keys").run();
    mocks.recordActivity.mockClear();
  });

  it("persists intent and reserves idempotency before transport submission", () => {
    prepareOutboundDispatch({
      messageId: "message-1",
      to: "6281234567890@s.whatsapp.net",
      recipientJid: "6281234567890@s.whatsapp.net",
      idempotencyKey: "request-1",
    });

    expect(getMessageStatus("message-1")).toMatchObject({
      id: "message-1",
      status: "pending",
      dispatchState: "prepared",
      providerMessageId: null,
    });
    expect(reservation("message-1")).toEqual({ key: "request-1", message_id: "message-1" });

    expect(() =>
      prepareOutboundDispatch({
        messageId: "message-2",
        to: "6281234567890@s.whatsapp.net",
        idempotencyKey: "request-1",
      }),
    ).toThrow(/already sent/i);
    expect(getMessageStatus("message-2")).toBeNull();
  });

  it("releases the reservation when a dispatch is explicitly abandoned", () => {
    prepareOutboundDispatch({
      messageId: "message-1",
      to: "6281234567890@s.whatsapp.net",
      idempotencyKey: "request-1",
    });
    markOutboundDispatchSubmitting("message-1");

    abandonOutboundDispatch("message-1");

    expect(getMessageStatus("message-1")).toBeNull();
    expect(reservation("message-1")).toBeUndefined();
    expect(() =>
      prepareOutboundDispatch({
        messageId: "message-2",
        to: "6281234567890@s.whatsapp.net",
        idempotencyKey: "request-1",
      }),
    ).not.toThrow();
  });

  it("marks an interrupted submission indeterminate without releasing its idempotency reservation", () => {
    prepareOutboundDispatch({
      messageId: "message-1",
      to: "6281234567890@s.whatsapp.net",
      idempotencyKey: "request-1",
    });
    markOutboundDispatchSubmitting("message-1");

    expect(recoverInterruptedOutboundDispatches()).toEqual({ abandoned: 0, indeterminate: 1 });
    expect(getMessageStatus("message-1")).toMatchObject({
      status: "pending",
      dispatchState: "indeterminate",
      providerMessageId: null,
    });
    expect(reservation("message-1")).toEqual({ key: "request-1", message_id: "message-1" });
    expect(mocks.recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "message.outcome_indeterminate",
        metadata: expect.objectContaining({ messageId: "message-1", reason: "restart" }),
      }),
    );
    expect(recoverInterruptedOutboundDispatches()).toEqual({ abandoned: 0, indeterminate: 0 });
  });

  it("abandons prepared intents on restart because the transport call never began", () => {
    prepareOutboundDispatch({
      messageId: "message-1",
      to: "6281234567890@s.whatsapp.net",
      idempotencyKey: "request-1",
    });

    expect(recoverInterruptedOutboundDispatches()).toEqual({ abandoned: 1, indeterminate: 0 });
    expect(getMessageStatus("message-1")).toBeNull();
    expect(reservation("message-1")).toBeUndefined();
  });

  it("leaves submitted messages untouched during restart recovery", () => {
    prepareOutboundDispatch({
      messageId: "message-1",
      to: "6281234567890@s.whatsapp.net",
      idempotencyKey: "request-1",
    });
    markOutboundDispatchSubmitting("message-1");
    markOutboundDispatchSubmitted("message-1", "provider-1");

    expect(recoverInterruptedOutboundDispatches()).toEqual({ abandoned: 0, indeterminate: 0 });
    expect(getMessageStatus("message-1")).toMatchObject({
      status: "pending",
      dispatchState: "submitted",
      providerMessageId: "provider-1",
    });
    expect(reservation("message-1")).toEqual({ key: "request-1", message_id: "message-1" });
  });
});
