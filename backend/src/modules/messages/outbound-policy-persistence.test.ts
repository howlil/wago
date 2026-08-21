import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { allowRecipientJid, resetRecipientStoreForTest } from "../recipients/store.js";
import {
  checkOutboundPolicy,
  markRecipientReachoutRestricted,
  type OutboundPolicyInput,
  recordOutboundAccepted,
  resetOutboundPolicyState,
} from "./outbound-policy.js";

function makeInput(overrides: Partial<OutboundPolicyInput> = {}): OutboundPolicyInput {
  return {
    to: "6281234567890",
    jid: "6281234567890@s.whatsapp.net",
    text: "Hello",
    ...overrides,
  };
}

describe("outbound policy persistence", () => {
  beforeEach(async () => {
    await resetOutboundPolicyState();
    await resetRecipientStoreForTest();
    await allowRecipientJid(makeInput().jid);
  });

  afterEach(async () => {
    await resetOutboundPolicyState();
    await resetRecipientStoreForTest();
  });

  it("keeps idempotency protection in SQLite-backed policy state", async () => {
    const input = makeInput({ idempotencyKey: "durable-order-123" });
    expect(await checkOutboundPolicy(input)).toEqual({ allowed: true });
    await recordOutboundAccepted(input, "msg-1");

    expect(await checkOutboundPolicy(input)).toEqual({
      allowed: false,
      reason: "DUPLICATE_MESSAGE",
      message: 'Message with idempotency key "durable-order-123" was already sent',
    });
  });

  it("keeps successful recipients classified as known from durable recipient state", async () => {
    const input = makeInput();
    expect(await checkOutboundPolicy(input)).toEqual({ allowed: true });
    await recordOutboundAccepted(input, "msg-known");

    const decision = await checkOutboundPolicy(input);
    expect(decision).toEqual({ allowed: true });
  });

  it("keeps per-recipient rate windows in SQLite-backed policy state", async () => {
    const input = makeInput();

    for (let index = 0; index < 5; index++) {
      expect((await checkOutboundPolicy(input)).allowed).toBe(true);
      await recordOutboundAccepted(input, `msg-${index}`);
    }

    const decision = await checkOutboundPolicy(input);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toBe("RECIPIENT_RATE_LIMITED");
    }
  });

  it("keeps recipient reach-out cooldowns in SQLite-backed policy state", async () => {
    const retryAt = Date.now() + 60_000;
    await markRecipientReachoutRestricted(makeInput().jid, retryAt);

    const decision = await checkOutboundPolicy(makeInput());
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toBe("WA_REACHOUT_RESTRICTED");
      expect(decision.retryAt?.getTime()).toBe(retryAt);
    }
  });
});
