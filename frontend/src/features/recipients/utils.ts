import type { RecipientRecord } from "../../api.js";

export function phoneFromJid(jid: string): string {
  return jid.split("@")[0]?.split(":")[0] ?? jid;
}

export function recipientStatus(recipient: RecipientRecord): { label: string; className: string } {
  if (recipient.optedOut) {
    return { label: "Opted out", className: "bg-[#fff0f1] text-[#9c2932]" };
  }

  if (recipient.allowed) {
    return { label: "Allowed", className: "bg-[#e5f5ee] text-[#176b55]" };
  }

  return { label: "Not allowed", className: "bg-[#fff5dc] text-[#916000]" };
}
