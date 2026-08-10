import { flushActivityStore } from "../activity/store.js";
import { flushOutboundPolicyPersistence } from "../policy/outbound-policy.js";
import { flushRecipientStore } from "../recipients/store.js";

export async function flushPersistence(): Promise<void> {
  await Promise.all([flushActivityStore(), flushRecipientStore(), flushOutboundPolicyPersistence()]);
}
