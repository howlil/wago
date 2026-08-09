import { ShieldCheck } from "lucide-react";
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

export function RecipientAccessCard({
  enabled,
  refreshKey = 0,
  suggestedPhone,
  onAllowed,
}: RecipientAccessCardProps) {
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
    <section id="recipients" className={`${cardBodyClass} scroll-mt-28`}>
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e9f4ef] text-[#176b55]">
          <ShieldCheck size={19} />
        </span>
        <div>
          <h2 className={sectionTitleClass}>Recipient Access</h2>
          <p className={sectionDescriptionClass}>
            Explicitly allow outbound recipients here. Opt-outs remain blocked until permission is intentionally restored.
          </p>
        </div>
      </div>

      {!enabled ? (
        <p className="mb-0 rounded-xl bg-[#f4f7f5] px-4 py-3 text-sm text-[#718179]">
          Authenticate the gateway to manage recipients.
        </p>
      ) : (
        <>
          <RecipientForm
            phone={phone}
            label={label}
            busy={Boolean(busyPhone)}
            onPhoneChange={setPhone}
            onLabelChange={setLabel}
            onSubmit={handleAllow}
          />

          {notice ? (
            <p
              className={`mb-0 mt-3 rounded-xl px-3.5 py-2.5 text-sm ${
                notice.type === "success" ? "bg-[#e5f5ee] text-[#176b55]" : "bg-[#fff0f1] text-[#9c2932]"
              }`}
            >
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
