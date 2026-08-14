import { flushActivityStore } from "../activity/store.js";
import { flushOutboundPolicyPersistence } from "../modules/messages/outbound-policy.js";
import { flushRecipientStore } from "../recipients/store.js";
import { closeDatabase } from "./database.js";

export async function flushPersistence(): Promise<void> {
  await Promise.all([flushActivityStore(), flushRecipientStore(), flushOutboundPolicyPersistence()]);
  closeDatabase();
}
