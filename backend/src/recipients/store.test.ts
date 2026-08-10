import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  allowRecipient,
  getRecipientByJid,
  listRecipients,
  optOutRecipient,
  rememberRecipientResolution,
  rememberSuccessfulOutbound,
  resetRecipientStoreForTest,
} from "./store.js";

describe("recipient store", () => {
  beforeEach(async () => {
    await resetRecipientStoreForTest();
  });

  afterEach(async () => {
    await resetRecipientStoreForTest();
  });

  it("allows and lists recipients", async () => {
    const recipient = await allowRecipient("081234567890", "Customer A");

    expect(recipient).toMatchObject({
      jid: "6281234567890@s.whatsapp.net",
      label: "Customer A",
      allowed: true,
      optedOut: false,
    });
    await expect(listRecipients()).resolves.toHaveLength(1);
  });

  it("serializes concurrent mutations without losing recipients", async () => {
    await Promise.all([
      allowRecipient("628111111111"),
      allowRecipient("628222222222"),
      allowRecipient("628333333333"),
      allowRecipient("628444444444"),
    ]);

    const recipients = await listRecipients();
    expect(recipients.map((recipient) => recipient.jid)).toEqual([
      "628111111111@s.whatsapp.net",
      "628222222222@s.whatsapp.net",
      "628333333333@s.whatsapp.net",
      "628444444444@s.whatsapp.net",
    ]);
  });

  it("persists opt-out state", async () => {
    await allowRecipient("6281234567890", "Customer A");

    const recipient = await optOutRecipient("6281234567890");

    expect(recipient).toMatchObject({
      jid: "6281234567890@s.whatsapp.net",
      allowed: true,
      optedOut: true,
    });
  });

  it("stores Baileys resolved JID for an existing recipient", async () => {
    await allowRecipient("6281234567890");
    await rememberRecipientResolution("6281234567890@s.whatsapp.net", "lid-user@s.whatsapp.net");

    await expect(getRecipientByJid("6281234567890@s.whatsapp.net")).resolves.toMatchObject({
      resolvedJid: "lid-user@s.whatsapp.net",
    });
  });

  it("persists successful outbound history used for new-chat classification", async () => {
    const jid = "6281234567890@s.whatsapp.net";
    await allowRecipient("6281234567890");
    await rememberSuccessfulOutbound(jid, "lid-user@s.whatsapp.net");

    const recipient = await getRecipientByJid(jid);
    expect(recipient?.resolvedJid).toBe("lid-user@s.whatsapp.net");
    expect(recipient?.lastSuccessfulOutboundAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
