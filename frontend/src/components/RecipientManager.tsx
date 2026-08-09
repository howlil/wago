import { Check, Loader2, ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { allowRecipient, listRecipients, optOutRecipient, type RecipientRecord } from "../api.js";

type RecipientManagerProps = {
  enabled: boolean;
  refreshKey?: number;
  suggestedPhone?: string | null;
  onAllowed?: (phone: string) => void;
};

type LocalNotice = { type: "success" | "error"; message: string } | null;

const inputClass =
  "w-full rounded-lg border border-[#cdd9d5] bg-white px-3 py-2.5 text-[#1f2a32] outline-none focus:border-[#2f8f71] focus:ring-3 focus:ring-[#cde9df]";
const secondaryButtonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#cdd9d5] bg-white px-3.5 text-[#1f2a32] disabled:cursor-not-allowed disabled:bg-[#eef3f1] disabled:text-[#667972]";
const primaryButtonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#176b55] px-3.5 text-white disabled:cursor-not-allowed disabled:bg-[#91aaa0] disabled:text-[#ecf1ef]";

function phoneFromJid(jid: string): string {
  return jid.split("@")[0]?.split(":")[0] ?? jid;
}

function recipientStatus(recipient: RecipientRecord): { label: string; className: string } {
  if (recipient.optedOut) {
    return { label: "Opted out", className: "bg-[#f8d7da] text-[#842029]" };
  }

  if (recipient.allowed) {
    return { label: "Allowed", className: "bg-[#dff3e9] text-[#0f5138]" };
  }

  return { label: "Not allowed", className: "bg-[#fff3cd] text-[#664d03]" };
}

export function RecipientManager({ enabled, refreshKey = 0, suggestedPhone, onAllowed }: RecipientManagerProps) {
  const [recipients, setRecipients] = useState<RecipientRecord[]>([]);
  const [phone, setPhone] = useState("");
  const [label, setLabel] = useState("");
  const [notice, setNotice] = useState<LocalNotice>(null);
  const [loading, setLoading] = useState(false);
  const [busyPhone, setBusyPhone] = useState<string | null>(null);

  const loadRecipients = useCallback(async () => {
    if (!enabled) {
      setRecipients([]);
      return;
    }

    setLoading(true);
    try {
      const result = await listRecipients();
      setRecipients(result.recipients);
    } catch (error) {
      const apiError = error as { message?: string };
      setNotice({ type: "error", message: apiError.message ?? "Failed to load recipient access list." });
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void loadRecipients();
  }, [loadRecipients, refreshKey]);

  useEffect(() => {
    if (suggestedPhone) {
      setPhone(suggestedPhone);
    }
  }, [suggestedPhone]);

  async function handleAllow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const candidate = phone.trim();

    if (!candidate) {
      setNotice({ type: "error", message: "Enter a phone number first." });
      return;
    }

    setBusyPhone(candidate);
    setNotice(null);

    try {
      await allowRecipient(candidate, label);
      setNotice({ type: "success", message: `${candidate} is allowed for outbound messages.` });
      setPhone("");
      setLabel("");
      onAllowed?.(candidate);
      await loadRecipients();
    } catch (error) {
      const apiError = error as { message?: string };
      setNotice({ type: "error", message: apiError.message ?? "Failed to allow recipient." });
    } finally {
      setBusyPhone(null);
    }
  }

  async function handleOptOut(recipient: RecipientRecord) {
    const candidate = phoneFromJid(recipient.jid);
    setBusyPhone(candidate);
    setNotice(null);

    try {
      await optOutRecipient(candidate);
      setNotice({ type: "success", message: `${candidate} is now opted out.` });
      await loadRecipients();
    } catch (error) {
      const apiError = error as { message?: string };
      setNotice({ type: "error", message: apiError.message ?? "Failed to opt out recipient." });
    } finally {
      setBusyPhone(null);
    }
  }

  async function handleReallow(recipient: RecipientRecord) {
    const candidate = phoneFromJid(recipient.jid);
    setBusyPhone(candidate);
    setNotice(null);

    try {
      await allowRecipient(candidate, recipient.label);
      setNotice({ type: "success", message: `${candidate} is allowed again.` });
      onAllowed?.(candidate);
      await loadRecipients();
    } catch (error) {
      const apiError = error as { message?: string };
      setNotice({ type: "error", message: apiError.message ?? "Failed to allow recipient." });
    } finally {
      setBusyPhone(null);
    }
  }

  return (
    <section className="mt-4 rounded-lg border border-[#d9e3df] bg-white p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#edf6f2] text-[#176b55]">
          <ShieldCheck size={18} />
        </span>
        <div>
          <h2 className="mb-1 text-xl">Recipient Access</h2>
          <p className="m-0 text-sm text-[#667972]">
            Outbound messages are allowed only for recipients you explicitly permit. Opt-outs stay blocked until you
            re-allow them.
          </p>
        </div>
      </div>

      {!enabled ? (
        <p className="m-0 rounded-lg bg-[#f7faf9] px-3.5 py-3 text-sm text-[#667972]">
          Authenticate the gateway to manage recipients.
        </p>
      ) : (
        <>
          <form onSubmit={handleAllow} className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto] gap-2 max-[720px]:grid-cols-1">
            <input
              className={inputClass}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="628xxxxxxxxxx"
              aria-label="Recipient phone"
            />
            <input
              className={inputClass}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Label (optional)"
              aria-label="Recipient label"
            />
            <button className={primaryButtonClass} type="submit" disabled={Boolean(busyPhone)}>
              {busyPhone === phone.trim() && busyPhone ? <Loader2 className="animate-spin" size={17} /> : <UserPlus size={17} />}
              Allow
            </button>
          </form>

          {notice ? (
            <p
              className={`mt-3 rounded-lg px-3.5 py-2.5 text-sm ${
                notice.type === "success" ? "bg-[#dff3e9] text-[#0f5138]" : "bg-[#f8d7da] text-[#842029]"
              }`}
            >
              {notice.message}
            </p>
          ) : null}

          <div className="mt-4 overflow-hidden rounded-lg border border-[#e3ebe8]">
            {loading ? (
              <div className="flex items-center gap-2 px-4 py-4 text-sm text-[#667972]">
                <Loader2 className="animate-spin" size={16} /> Loading recipients
              </div>
            ) : recipients.length === 0 ? (
              <p className="m-0 px-4 py-4 text-sm text-[#667972]">No recipients have been added yet.</p>
            ) : (
              <div className="divide-y divide-[#e3ebe8]">
                {recipients.map((recipient) => {
                  const recipientPhone = phoneFromJid(recipient.jid);
                  const status = recipientStatus(recipient);
                  const busy = busyPhone === recipientPhone;

                  return (
                    <div
                      key={recipient.jid}
                      className="flex items-center justify-between gap-3 px-4 py-3 max-[680px]:flex-col max-[680px]:items-start"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="font-mono text-sm text-[#1f2a32]">{recipientPhone}</strong>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${status.className}`}>{status.label}</span>
                        </div>
                        {recipient.label ? <span className="mt-1 block text-xs text-[#667972]">{recipient.label}</span> : null}
                      </div>

                      {recipient.allowed && !recipient.optedOut ? (
                        <button
                          className={`${secondaryButtonClass} border-[#e9b7bd] text-[#842029]`}
                          type="button"
                          onClick={() => void handleOptOut(recipient)}
                          disabled={busy}
                        >
                          {busy ? <Loader2 className="animate-spin" size={16} /> : <UserMinus size={16} />}
                          Opt out
                        </button>
                      ) : (
                        <button
                          className={secondaryButtonClass}
                          type="button"
                          onClick={() => void handleReallow(recipient)}
                          disabled={busy}
                        >
                          {busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                          Allow again
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
