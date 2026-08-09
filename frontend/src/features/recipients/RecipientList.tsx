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
      <div className="mt-3 flex items-center gap-2 rounded-md border border-wago-line px-3 py-4 text-xs text-wago-muted">
        <Loader2 className="animate-spin" size={14} /> Loading recipients
      </div>
    );
  }

  if (recipients.length === 0) {
    return (
      <p className="mb-0 mt-3 rounded-md border border-dashed border-wago-line px-3 py-4 text-xs text-wago-muted">
        No recipients have been added yet.
      </p>
    );
  }

  return (
    <div className="mt-3 overflow-hidden rounded-md border border-wago-line">
      <div className="divide-y divide-[#e8ece9]">
        {recipients.map((recipient) => {
          const recipientPhone = phoneFromJid(recipient.jid);
          const status = recipientStatus(recipient);
          const busy = busyPhone === recipientPhone;

          return (
            <div
              key={recipient.jid}
              className="flex items-center justify-between gap-3 bg-white px-3 py-2.5 max-[620px]:flex-col max-[620px]:items-start"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="font-mono text-xs font-semibold text-[#26362f]">{recipientPhone}</strong>
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                {recipient.label ? (
                  <span className="mt-0.5 block text-[11px] text-[#7b8680]">{recipient.label}</span>
                ) : null}
              </div>

              {recipient.allowed && !recipient.optedOut ? (
                <button className={dangerButtonClass} type="button" onClick={() => onOptOut(recipient)} disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" size={13} /> : <UserMinus size={13} />}
                  Opt out
                </button>
              ) : (
                <button
                  className={secondaryButtonClass}
                  type="button"
                  onClick={() => onReallow(recipient)}
                  disabled={busy}
                >
                  {busy ? <Loader2 className="animate-spin" size={13} /> : <Check size={13} />}
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
