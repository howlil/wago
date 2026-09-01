import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { allowRecipientJid, resetRecipientStoreForTest } from "../recipients/store.js";
import { checkOutboundPolicy, resetOutboundPolicyState } from "./outbound-policy.js";

const jid = "6281234567890@s.whatsapp.net";

describe("outbound policy account health boundary", () => {
  beforeEach(async () => {
    await resetRecipientStoreForTest();
    await resetOutboundPolicyState();
    await allowRecipientJid(jid);
  });

  afterEach(async () => {
    await resetOutboundPolicyState();
    await resetRecipientStoreForTest();
  });

  it("delegates account-health policy through the injected callback", async () => {
    const accountHealthCheck = vi.fn(async ({ isNewRecipient }: { isNewRecipient: boolean }) => ({
      allowed: false as const,
      reason: "WA_NEW_CHAT_CAPPED" as const,
      message: isNewRecipient ? "new chat capped" : "unexpected known recipient",
    }));

    const decision = await checkOutboundPolicy({
      to: "6281234567890",
      jid,
      text: "Hello",
      accountHealthCheck,
    });

    expect(accountHealthCheck).toHaveBeenCalledOnce();
    expect(accountHealthCheck).toHaveBeenCalledWith({ isNewRecipient: true });
    expect(decision).toEqual({
      allowed: false,
      reason: "WA_NEW_CHAT_CAPPED",
      message: "new chat capped",
    });
  });
});
