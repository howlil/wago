import { Check, Loader2, UserMinus } from "lucide-react";
import { dangerButtonClass, secondaryButtonClass } from "../../shared/ui/classes.js";
import type { RecipientRecord } from "./api.js";
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
      <div className="mt-3 flex items-center gap-2 border-t border-wago-line px-1 py-4 text-xs text-wago-muted">
        <Loader2 className="animate-spin" size={14} /> Loading recipients
      </div>
    );
  }

  if (recipients.length === 0) {
    return (
      <p className="mb-0 mt-3 border-t border-wago-line px-1 pt-4 text-xs leading-5 text-wago-muted">
        No recipients have been added yet.
      </p>
    );
  }

  return (
    <div className="mt-3 max-h-[330px] overflow-y-auto rounded-md border border-wago-line">
      <div className="divide-y divide-wago-line">
        {recipients.map((recipient) => {
          const recipientPhone = phoneFromJid(recipient.jid);
          const status = recipientStatus(recipient);
          const busy = busyPhone === recipientPhone;

          return (
            <div
              key={recipient.jid}
              className="flex items-center justify-between gap-3 bg-white px-3 py-2.5 max-[620px]:flex-col max-[620px]:items-stretch"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <strong className="break-all font-mono text-xs font-semibold text-wago-ink">{recipientPhone}</strong>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${status.className}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${status.dotClassName}`} aria-hidden="true" />
                    {status.label}
                  </span>
                </div>
                {recipient.label ? (
                  <span className="mt-0.5 block break-words text-xs text-wago-muted">{recipient.label}</span>
                ) : null}
              </div>

              {recipient.allowed && !recipient.optedOut ? (
                <button
                  className={`${dangerButtonClass} max-[620px]:w-full`}
                  type="button"
                  onClick={() => onOptOut(recipient)}
                  disabled={busy}
                >
                  {busy ? <Loader2 className="animate-spin" size={13} /> : <UserMinus size={13} />}
                  Opt out
                </button>
              ) : (
                <button
                  className={`${secondaryButtonClass} max-[620px]:w-full`}
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
