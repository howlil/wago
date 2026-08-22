import { describe, expect, it } from "vitest";
import { ApplicationError } from "../../errors/application-error.js";
import { createOutboundPolicyError, isOutboundPolicyError, type OutboundPolicyDecision } from "./outbound-policy.js";

describe("outbound policy typed errors", () => {
  it("creates an ApplicationError with stable code and retry metadata", () => {
    const retryAt = new Date("2026-08-10T12:00:00.000Z");
    const decision: Exclude<OutboundPolicyDecision, { allowed: true }> = {
      allowed: false,
      reason: "WA_REACHOUT_RESTRICTED",
      message: "Outbound is restricted",
      retryAt,
    };

    const error = createOutboundPolicyError(decision);

    expect(error).toBeInstanceOf(ApplicationError);
    expect(error).toMatchObject({
      name: "ApplicationError",
      code: "WA_REACHOUT_RESTRICTED",
      message: "Outbound is restricted",
      retryAt,
    });
    expect(isOutboundPolicyError(error)).toBe(true);
  });

  it("does not trust a spoofed Error.name as a policy error", () => {
    const spoofed = new Error("blocked");
    spoofed.name = "ACCOUNT_RATE_LIMITED";

    expect(isOutboundPolicyError(spoofed)).toBe(false);
  });
});
