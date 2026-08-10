import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDatabase } from "../infrastructure/database.js";
import { allowRecipientJid, resetRecipientStoreForTest } from "../recipients/store.js";
import { type OutboundPolicyInput, recordOutboundAccepted, resetOutboundPolicyState } from "./outbound-policy.js";
import { isIdempotencyKeyActive } from "./outbound-policy-store.js";

const database = getDatabase();
const jid = "6281234567890@s.whatsapp.net";
const triggerName = "test_fail_recipient_success_update";

const input: OutboundPolicyInput = {
  to: "6281234567890",
  jid,
  text: "Hello",
  idempotencyKey: "persistence-failure-key",
};

describe("outbound accepted-state persistence failure", () => {
  beforeEach(async () => {
    database.exec(`DROP TRIGGER IF EXISTS ${triggerName}`);
    await resetOutboundPolicyState();
    await resetRecipientStoreForTest();
    await allowRecipientJid(jid);
  });

  afterEach(async () => {
    database.exec(`DROP TRIGGER IF EXISTS ${triggerName}`);
    await resetOutboundPolicyState();
    await resetRecipientStoreForTest();
  });

  it("propagates a typed failure and leaves no partial idempotency state", async () => {
    database.exec(`
      CREATE TRIGGER ${triggerName}
      BEFORE UPDATE OF last_successful_outbound_at ON recipients
      WHEN OLD.jid = '${jid}'
      BEGIN
        SELECT RAISE(FAIL, 'forced recipient persistence failure');
      END;
    `);

    await expect(recordOutboundAccepted(input, "message-1", jid)).rejects.toMatchObject({
      name: "ApplicationError",
      code: "OUTBOUND_STATE_PERSIST_FAILED",
    });

    expect(isIdempotencyKeyActive("persistence-failure-key", Date.now())).toBe(false);
  });
});
