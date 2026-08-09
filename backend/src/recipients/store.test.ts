import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  allowRecipient,
  getRecipientByJid,
  listRecipients,
  optOutRecipient,
  rememberRecipientResolution,
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
});
