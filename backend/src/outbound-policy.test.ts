import { describe, expect, it } from "vitest";
import {
  checkOutboundPolicy,
  createOutboundPolicyError,
  getOutboundPolicyHttpStatus,
  isOutboundPolicyError,
  recordOutboundAccepted,
  recordOutboundRejected,
  type OutboundPolicyDecision,
  type OutboundPolicyInput
} from "./outbound-policy.js";

const input: OutboundPolicyInput = {
  to: "6281234567890",
  jid: "6281234567890@s.whatsapp.net",
  text: "Hello",
  idempotencyKey: "welcome-1"
};

describe("outbound policy", () => {
  it("allows outbound messages by default while rules are introduced incrementally", async () => {
    await expect(checkOutboundPolicy(input)).resolves.toEqual({ allowed: true });
  });

  it("creates stable errors for blocked policy decisions", () => {
    const retryAt = new Date("2026-08-09T00:00:00.000Z");
    const decision: Exclude<OutboundPolicyDecision, { allowed: true }> = {
      allowed: false,
      reason: "WA_REACHOUT_RESTRICTED",
      message: "Outbound is restricted",
      retryAt
    };

    const error = createOutboundPolicyError(decision);

    expect(error.name).toBe("WA_REACHOUT_RESTRICTED");
    expect(error.message).toBe("Outbound is restricted");
    expect(isOutboundPolicyError(error)).toBe(true);
    expect((error as Error & { retryAt?: Date }).retryAt).toBe(retryAt);
  });

  it("maps policy reasons to stable HTTP statuses", () => {
    expect(getOutboundPolicyHttpStatus("RECIPIENT_NOT_ALLOWED")).toBe(403);
    expect(getOutboundPolicyHttpStatus("RECIPIENT_OPTED_OUT")).toBe(403);
    expect(getOutboundPolicyHttpStatus("DUPLICATE_MESSAGE")).toBe(409);
    expect(getOutboundPolicyHttpStatus("ACCOUNT_RATE_LIMITED")).toBe(429);
    expect(getOutboundPolicyHttpStatus("WA_NEW_CHAT_CAPPED")).toBe(429);
    expect(getOutboundPolicyHttpStatus("OUTBOUND_PAUSED")).toBe(503);
  });

  it("records outcomes without changing allowed-message behavior yet", () => {
    expect(() => recordOutboundAccepted(input, "message-id")).not.toThrow();
    expect(() => recordOutboundRejected(input, new Error("failed"))).not.toThrow();
  });
});
