import type { RecipientRecord } from "./api.js";

export function phoneFromJid(jid: string): string {
  return jid.split("@")[0]?.split(":")[0] ?? jid;
}

export function recipientStatus(recipient: RecipientRecord): { label: string; className: string } {
  if (recipient.optedOut) {
    return { label: "Opted out", className: "bg-wago-danger-soft text-wago-danger" };
  }

  if (recipient.allowed) {
    return { label: "Allowed", className: "bg-[#edf7f2] text-[#255c48]" };
  }

  return { label: "Not allowed", className: "bg-wago-warning-soft text-wago-warning" };
}
