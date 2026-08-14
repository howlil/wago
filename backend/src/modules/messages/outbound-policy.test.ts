import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApplicationError } from "../../errors/application-error.js";
import { allowRecipientJid, optOutRecipient, resetRecipientStoreForTest } from "../recipients/store.js";
import {
  checkOutboundPolicy,
  createOutboundPolicyError,
  isOutboundPolicyError,
  type OutboundPolicyDecision,
  type OutboundPolicyInput,
  pauseOutbound,
  recordOutboundAccepted,
  recordOutboundRejected,
  resetOutboundPolicyState,
  resumeOutbound,
} from "./outbound-policy.js";

function makeInput(overrides: Partial<OutboundPolicyInput> = {}): OutboundPolicyInput {
  return {
    to: "6281234567890",
    jid: "6281234567890@s.whatsapp.net",
    text: "Hello",
    ...overrides,
  };
}

describe("outbound policy", () => {
  beforeEach(async () => {
    await resetRecipientStoreForTest();
    await allowRecipientJid(makeInput().jid);
  });

  afterEach(async () => {
    resetOutboundPolicyState();
    await resetRecipientStoreForTest();
  });

  async function allowJid(jid: string): Promise<void> {
    await allowRecipientJid(jid);
  }

  // --- Outbound pause ---

  describe("outbound pause", () => {
    it("blocks all messages when outbound is paused", async () => {
      pauseOutbound();
      const decision = await checkOutboundPolicy(makeInput());

      expect(decision).toEqual({
        allowed: false,
        reason: "OUTBOUND_PAUSED",
        message: "Outbound messaging is paused",
      });
    });

    it("uses custom pause message when provided", async () => {
      pauseOutbound("Maintenance in progress");
      const decision = await checkOutboundPolicy(makeInput());

      expect(decision.allowed).toBe(false);
      if (!decision.allowed) {
        expect(decision.message).toBe("Maintenance in progress");
      }
    });

    it("allows messages after resume", async () => {
      pauseOutbound();
      resumeOutbound();
      const decision = await checkOutboundPolicy(makeInput());

      expect(decision).toEqual({ allowed: true });
    });
  });

  // --- Idempotency ---

  describe("idempotency", () => {
    it("blocks duplicate idempotency keys", async () => {
      const input = makeInput({ idempotencyKey: "order-123" });

      const first = await checkOutboundPolicy(input);
      expect(first.allowed).toBe(true);

      recordOutboundAccepted(input, "msg-1");

      const second = await checkOutboundPolicy(input);
      expect(second).toEqual({
        allowed: false,
        reason: "DUPLICATE_MESSAGE",
        message: 'Message with idempotency key "order-123" was already sent',
      });
    });

    it("allows messages without idempotency key", async () => {
      const input = makeInput({ idempotencyKey: undefined });

      const first = await checkOutboundPolicy(input);
      expect(first.allowed).toBe(true);
      recordOutboundAccepted(input, "msg-1");

      const second = await checkOutboundPolicy(input);
      expect(second.allowed).toBe(true);
    });

    it("does not consume idempotency key on rejection", async () => {
      const input = makeInput({ idempotencyKey: "retry-me" });

      const first = await checkOutboundPolicy(input);
      expect(first.allowed).toBe(true);

      recordOutboundRejected(input, new Error("network error"));

      const retry = await checkOutboundPolicy(input);
      expect(retry.allowed).toBe(true);
    });

    it("allows different idempotency keys independently", async () => {
      const input1 = makeInput({ idempotencyKey: "key-a" });
      const input2 = makeInput({ idempotencyKey: "key-b" });

      await checkOutboundPolicy(input1);
      recordOutboundAccepted(input1, "msg-1");

      const decision = await checkOutboundPolicy(input2);
      expect(decision.allowed).toBe(true);
    });
  });

  // --- Recipient controls ---

  describe("recipient controls", () => {
    it("blocks recipients that are not explicitly allowed", async () => {
      const decision = await checkOutboundPolicy(makeInput({ jid: "628999@s.whatsapp.net" }));

      expect(decision).toEqual({
        allowed: false,
        reason: "RECIPIENT_NOT_ALLOWED",
        message: "Recipient is not allowed for outbound messages",
      });
    });

    it("blocks opted-out recipients", async () => {
      await optOutRecipient("6281234567890");

      const decision = await checkOutboundPolicy(makeInput());

      expect(decision).toEqual({
        allowed: false,
        reason: "RECIPIENT_OPTED_OUT",
        message: "Recipient has opted out of outbound messages",
      });
    });
  });

  // --- Account health policy ---

  describe("account health policy", () => {
    it("propagates an active reachout restriction from the injected health check", async () => {
      const retryAt = new Date(Date.now() + 60_000);
      const decision = await checkOutboundPolicy(
        makeInput({
          accountHealthCheck: async () => ({
            allowed: false,
            reason: "WA_REACHOUT_RESTRICTED",
            message: "WhatsApp reports this account is restricted from starting new outbound reach-outs",
            retryAt,
          }),
        }),
      );

      expect(decision.allowed).toBe(false);
      if (!decision.allowed) {
        expect(decision.reason).toBe("WA_REACHOUT_RESTRICTED");
        expect(decision.retryAt).toBe(retryAt);
      }
    });

    it("propagates a capped new-chat decision from the injected health check", async () => {
      const decision = await checkOutboundPolicy(
        makeInput({
          accountHealthCheck: async () => ({
            allowed: false,
            reason: "WA_NEW_CHAT_CAPPED",
            message: "WhatsApp reports this account has reached its new-chat cap",
          }),
        }),
      );

      expect(decision).toEqual({
        allowed: false,
        reason: "WA_NEW_CHAT_CAPPED",
        message: "WhatsApp reports this account has reached its new-chat cap",
      });
    });
  });

  // --- Account rate limit ---

  describe("account rate limit", () => {
    it("allows messages below the account limit", async () => {
      for (let i = 0; i < 10; i++) {
        const input = makeInput({ jid: `628${i}@s.whatsapp.net` });
        await allowJid(input.jid);
        const decision = await checkOutboundPolicy(input);
        expect(decision.allowed).toBe(true);
        recordOutboundAccepted(input, `msg-${i}`);
      }
    });

    it("blocks messages at the account limit", async () => {
      // Use 6 recipients x 5 messages = 30 total, staying under new-chat (10) and per-recipient (5) limits
      for (let r = 0; r < 6; r++) {
        for (let m = 0; m < 5; m++) {
          const input = makeInput({ jid: `628${r}@s.whatsapp.net` });
          await allowJid(input.jid);
          const decision = await checkOutboundPolicy(input);
          expect(decision.allowed).toBe(true);
          recordOutboundAccepted(input, `msg-${r}-${m}`);
        }
      }

      // Next message to a known recipient should be blocked at account level
      const input = makeInput({ jid: "6280@s.whatsapp.net" });
      await allowJid(input.jid);
      const decision = await checkOutboundPolicy(input);

      expect(decision.allowed).toBe(false);
      if (!decision.allowed) {
        expect(decision.reason).toBe("ACCOUNT_RATE_LIMITED");
        expect(decision.retryAt).toBeInstanceOf(Date);
      }
    });
  });

  // --- Recipient rate limit ---

  describe("recipient rate limit", () => {
    it("allows messages below the per-recipient limit", async () => {
      const input = makeInput();

      for (let i = 0; i < 4; i++) {
        const decision = await checkOutboundPolicy(input);
        expect(decision.allowed).toBe(true);
        recordOutboundAccepted(input, `msg-${i}`);
      }
    });

    it("blocks messages at the per-recipient limit", async () => {
      const input = makeInput();

      for (let i = 0; i < 5; i++) {
        const decision = await checkOutboundPolicy(input);
        expect(decision.allowed).toBe(true);
        recordOutboundAccepted(input, `msg-${i}`);
      }

      const decision = await checkOutboundPolicy(input);

      expect(decision.allowed).toBe(false);
      if (!decision.allowed) {
        expect(decision.reason).toBe("RECIPIENT_RATE_LIMITED");
        expect(decision.retryAt).toBeInstanceOf(Date);
      }
    });

    it("allows sends to different recipients independently", async () => {
      const inputA = makeInput({ jid: "628111@s.whatsapp.net" });
      const inputB = makeInput({ jid: "628222@s.whatsapp.net" });
      await allowJid(inputA.jid);
      await allowJid(inputB.jid);

      for (let i = 0; i < 5; i++) {
        await checkOutboundPolicy(inputA);
        recordOutboundAccepted(inputA, `msg-a-${i}`);
      }

      const decision = await checkOutboundPolicy(inputB);
      expect(decision.allowed).toBe(true);
    });
  });

  // --- New-chat rate limit ---

  describe("new-chat rate limit", () => {
    it("allows new chats below the limit", async () => {
      for (let i = 0; i < 5; i++) {
        const input = makeInput({ jid: `628${i}@s.whatsapp.net` });
        await allowJid(input.jid);
        const decision = await checkOutboundPolicy(input);
        expect(decision.allowed).toBe(true);
        recordOutboundAccepted(input, `msg-${i}`);
      }
    });

    it("blocks new chats at the limit", async () => {
      // Fill new-chat limit (10 unique recipients)
      for (let i = 0; i < 10; i++) {
        const input = makeInput({ jid: `6280000000${i.toString().padStart(2, "0")}@s.whatsapp.net` });
        await allowJid(input.jid);
        const decision = await checkOutboundPolicy(input);
        expect(decision.allowed).toBe(true);
        recordOutboundAccepted(input, `msg-${i}`);
      }

      // Next new-chat should be blocked
      const input = makeInput({ jid: "62899999999@s.whatsapp.net" });
      await allowJid(input.jid);
      const decision = await checkOutboundPolicy(input);

      expect(decision.allowed).toBe(false);
      if (!decision.allowed) {
        expect(decision.reason).toBe("NEW_CHAT_RATE_LIMITED");
        expect(decision.retryAt).toBeInstanceOf(Date);
      }
    });

    it("allows sending to known recipients even when new-chat limit is reached", async () => {
      // Send to one recipient first (makes it known)
      const knownInput = makeInput({ jid: "628111@s.whatsapp.net" });
      await allowJid(knownInput.jid);
      await checkOutboundPolicy(knownInput);
      recordOutboundAccepted(knownInput, "msg-known");

      // Fill new-chat limit with 10 more unique recipients
      for (let i = 0; i < 10; i++) {
        const input = makeInput({ jid: `6280000000${i.toString().padStart(2, "0")}@s.whatsapp.net` });
        await allowJid(input.jid);
        // Some of these may hit the new-chat limit, that's fine for this test setup
        await checkOutboundPolicy(input);
        recordOutboundAccepted(input, `msg-${i}`);
      }

      // Known recipient should still be allowed (not a new chat)
      const decision = await checkOutboundPolicy(knownInput);
      expect(decision.allowed).toBe(true);
    });
  });

  // --- Priority ordering ---

  describe("check priority", () => {
    it("outbound pause takes priority over all other checks", async () => {
      pauseOutbound();

      const input = makeInput({ idempotencyKey: "dup-key" });
      recordOutboundAccepted(input, "msg-1");

      const decision = await checkOutboundPolicy(input);
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) {
        expect(decision.reason).toBe("OUTBOUND_PAUSED");
      }
    });

    it("idempotency check runs before rate limits", async () => {
      const input = makeInput({ idempotencyKey: "first-send" });
      await checkOutboundPolicy(input);
      recordOutboundAccepted(input, "msg-1");

      // Even if account rate limit is not hit, duplicate should be caught
      const decision = await checkOutboundPolicy(input);
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) {
        expect(decision.reason).toBe("DUPLICATE_MESSAGE");
      }
    });
  });

  // --- recordOutboundRejected ---

  describe("recordOutboundRejected", () => {
    it("does not throw", () => {
      expect(() => recordOutboundRejected(makeInput(), new Error("failed"))).not.toThrow();
    });

    it("does not count toward rate limits", async () => {
      const input = makeInput();

      // Reject many times
      for (let i = 0; i < 10; i++) {
        const decision = await checkOutboundPolicy(input);
        expect(decision.allowed).toBe(true);
        recordOutboundRejected(input, new Error("fail"));
      }

      // Should still be allowed because rejections don't count
      const decision = await checkOutboundPolicy(input);
      expect(decision.allowed).toBe(true);
    });
  });

  describe("error helpers", () => {
    it("creates typed errors for blocked policy decisions", () => {
      const retryAt = new Date("2026-08-09T00:00:00.000Z");
      const decision: Exclude<OutboundPolicyDecision, { allowed: true }> = {
        allowed: false,
        reason: "WA_REACHOUT_RESTRICTED",
        message: "Outbound is restricted",
        retryAt,
      };

      const error = createOutboundPolicyError(decision);

      expect(error).toBeInstanceOf(ApplicationError);
      expect(error.name).toBe("ApplicationError");
      expect(error.code).toBe("WA_REACHOUT_RESTRICTED");
      expect(error.message).toBe("Outbound is restricted");
      expect(error.retryAt).toBe(retryAt);
      expect(isOutboundPolicyError(error)).toBe(true);
    });

    it("detects only typed outbound policy errors", () => {
      const policyError = new ApplicationError("ACCOUNT_RATE_LIMITED", "blocked");
      const spoofed = new Error("blocked");
      spoofed.name = "ACCOUNT_RATE_LIMITED";

      expect(isOutboundPolicyError(policyError)).toBe(true);
      expect(isOutboundPolicyError(spoofed)).toBe(false);
      expect(isOutboundPolicyError(new Error("random"))).toBe(false);
      expect(isOutboundPolicyError("not an error")).toBe(false);
    });
  });
});
