import type { RecipientRecord } from "./api.js";

export function phoneFromJid(jid: string): string {
  return jid.split("@")[0]?.split(":")[0] ?? jid;
}

export function recipientStatus(recipient: RecipientRecord): {
  label: string;
  className: string;
  dotClassName: string;
} {
  if (recipient.optedOut) {
    return { label: "Opted out", className: "text-wago-danger", dotClassName: "bg-wago-danger" };
  }

  if (recipient.allowed) {
    return { label: "Allowed", className: "text-wago-positive", dotClassName: "bg-wago-positive" };
  }

  return { label: "Not allowed", className: "text-wago-warning", dotClassName: "bg-wago-warning" };
}
