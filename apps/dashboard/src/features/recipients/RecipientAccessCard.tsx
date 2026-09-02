import { type FormEvent, useCallback, useEffect, useState } from "react";
import { cardBodyClass, sectionDescriptionClass, sectionTitleClass } from "../../shared/ui/classes.js";
import { allowRecipient, listRecipients, optOutRecipient, type RecipientRecord } from "./api.js";
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
      <div>
        <h2 className={sectionTitleClass}>Recipient access</h2>
        <p className={sectionDescriptionClass}>Control who is approved for outbound messages.</p>
      </div>

      {!enabled ? (
        <p className="mb-0 mt-3 border-t border-wago-line pt-3 text-xs leading-5 text-wago-muted">
          Authenticate the gateway to manage recipients.
        </p>
      ) : (
        <>
          {notice ? (
            <p
              className={`mb-0 mt-3 rounded-md px-3 py-2 text-xs ${notice.type === "success" ? "bg-[#edf7f2] text-[#255c48]" : "bg-wago-danger-soft text-wago-danger"}`}
            >
              {notice.message}
            </p>
          ) : null}

          <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] xl:gap-6">
            <div className="min-w-0">
              <h3 className="m-0 text-xs font-semibold text-wago-ink">Allow recipient</h3>
              <p className="mb-2 mt-0.5 text-xs leading-5 text-wago-muted">
                Add a phone number before an application can start a new outbound conversation.
              </p>
              <RecipientForm
                phone={phone}
                label={label}
                busy={Boolean(busyPhone)}
                onPhoneChange={setPhone}
                onLabelChange={setLabel}
                onSubmit={handleAllow}
              />
            </div>

            <div className="min-w-0 border-t border-wago-line pt-4 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="m-0 text-xs font-semibold text-wago-ink">Saved recipients</h3>
                  <p className="mb-0 mt-0.5 text-xs leading-5 text-wago-muted">
                    Current outbound recipient policy and opt-out state.
                  </p>
                </div>
                <span className="shrink-0 text-[10px] text-wago-tertiary">{recipients.length} saved</span>
              </div>

              <RecipientList
                recipients={recipients}
                loading={loading}
                busyPhone={busyPhone}
                onOptOut={(recipient) => void handleOptOut(recipient)}
                onReallow={(recipient) => void handleReallow(recipient)}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
