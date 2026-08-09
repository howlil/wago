import { Check, Loader2, UserMinus } from "lucide-react";
import type { RecipientRecord } from "../../api.js";
import { dangerButtonClass, secondaryButtonClass } from "../../shared/ui/classes.js";
import { phoneFromJid, recipientStatus } from "./utils.js";

type RecipientListProps = {
  recipients: RecipientRecord[];
  loading: boolean;
  busyPhone: string | null;
  onOptOut: (recipient: RecipientRecord) => void;
  onReallow: (recipient: RecipientRecord) => void;
};

export function RecipientList({ recipients, loading, busyPhone, onOptOut, onReallow }: RecipientListProps) {
  if (loading) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#e0e8e4] px-4 py-5 text-sm text-[#718179]">
        <Loader2 className="animate-spin" size={16} /> Loading recipients
      </div>
    );
  }

  if (recipients.length === 0) {
    return (
      <p className="mb-0 mt-4 rounded-xl border border-dashed border-[#d8e2dd] px-4 py-5 text-sm text-[#718179]">
        No recipients have been added yet.
      </p>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-[#e0e8e4]">
      <div className="divide-y divide-[#e7edea]">
        {recipients.map((recipient) => {
          const recipientPhone = phoneFromJid(recipient.jid);
          const status = recipientStatus(recipient);
          const busy = busyPhone === recipientPhone;

          return (
            <div
              key={recipient.jid}
              className="flex items-center justify-between gap-3 bg-white px-4 py-3.5 max-[680px]:flex-col max-[680px]:items-start"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="font-mono text-sm text-[#21342c]">{recipientPhone}</strong>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                {recipient.label ? <span className="mt-1 block text-xs text-[#718179]">{recipient.label}</span> : null}
              </div>

              {recipient.allowed && !recipient.optedOut ? (
                <button className={dangerButtonClass} type="button" onClick={() => onOptOut(recipient)} disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" size={15} /> : <UserMinus size={15} />}
                  Opt out
                </button>
              ) : (
                <button
                  className={secondaryButtonClass}
                  type="button"
                  onClick={() => onReallow(recipient)}
                  disabled={busy}
                >
                  {busy ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />}
                  Allow again
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
