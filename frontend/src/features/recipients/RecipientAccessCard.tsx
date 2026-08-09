import { type FormEvent, useCallback, useEffect, useState } from "react";
import { allowRecipient, listRecipients, optOutRecipient, type RecipientRecord } from "../../api.js";
import { cardBodyClass, sectionDescriptionClass, sectionTitleClass } from "../../shared/ui/classes.js";
import { RecipientForm } from "./RecipientForm.js";
import { RecipientList } from "./RecipientList.js";
import { phoneFromJid } from "./utils.js";

type RecipientAccessCardProps = {
  enabled: boolean;
  refreshKey?: number;
  suggestedPhone?: string | null;
  onAllowed?: (phone: string) => void;
};

type LocalNotice = { type: "success" | "error"; message: string } | null;

export function RecipientAccessCard({ enabled, refreshKey = 0, suggestedPhone, onAllowed }: RecipientAccessCardProps) {
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
    if (refreshKey >= 0) {
      void loadRecipients();
    }
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
    <section className={cardBodyClass}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className={sectionTitleClass}>Recipient access</h2>
          <p className={sectionDescriptionClass}>Manage who can receive outbound messages. Opt-outs remain blocked until explicitly restored.</p>
        </div>
        {enabled ? <span className="text-xs text-[#7b8680]">{recipients.length} saved</span> : null}
      </div>

      {!enabled ? (
        <p className="mb-0 mt-4 rounded-md border border-dashed border-wago-line px-3 py-4 text-sm text-wago-muted">
          Authenticate the gateway to manage recipients.
        </p>
      ) : (
        <>
          <div className="mt-4">
            <RecipientForm
              phone={phone}
              label={label}
              busy={Boolean(busyPhone)}
              onPhoneChange={setPhone}
              onLabelChange={setLabel}
              onSubmit={handleAllow}
            />
          </div>

          {notice ? (
            <p className={`mb-0 mt-2 rounded-md px-3 py-2 text-xs ${notice.type === "success" ? "bg-[#edf7f2] text-[#255c48]" : "bg-wago-danger-soft text-wago-danger"}`}>
              {notice.message}
            </p>
          ) : null}

          <RecipientList
            recipients={recipients}
            loading={loading}
            busyPhone={busyPhone}
            onOptOut={(recipient) => void handleOptOut(recipient)}
            onReallow={(recipient) => void handleReallow(recipient)}
          />
        </>
      )}
    </section>
  );
}
