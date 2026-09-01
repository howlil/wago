import { Check, Loader2, Send } from "lucide-react";
import type { FormEvent } from "react";
import {
  cardBodyClass,
  fieldLabelClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  sectionDescriptionClass,
  sectionTitleClass,
} from "../../shared/ui/classes.js";
import type { WhatsAppStatus } from "../whatsapp/api.js";

type SendMessageCardProps = {
  status: WhatsAppStatus;
  phone: string;
  message: string;
  isSending: boolean;
  canSend: boolean;
  approvalRequired: boolean;
  onPhoneChange: (value: string) => void;
  onMessageChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onAllowAndSend: () => void;
};

export function SendMessageCard({
  status,
  phone,
  message,
  isSending,
  canSend,
  approvalRequired,
  onPhoneChange,
  onMessageChange,
  onSubmit,
  onAllowAndSend,
}: SendMessageCardProps) {
  return (
    <section className={cardBodyClass}>
      <div>
        <h2 className={sectionTitleClass}>Send a message</h2>
        <p className={sectionDescriptionClass}>
          {status === "connected"
            ? "Use the bound session for a direct outbound test. Recipient permission is enforced."
            : "Connect WhatsApp before sending messages."}
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-4 grid gap-3">
        <label>
          <span className={fieldLabelClass}>Recipient phone</span>
          <input
            className={inputClass}
            value={phone}
            onChange={(event) => onPhoneChange(event.target.value)}
            placeholder="628xxxxxxxxxx"
            autoComplete="tel"
            aria-label="Message recipient phone"
          />
        </label>

        <label>
          <span className={fieldLabelClass}>Message</span>
          <textarea
            className={`${inputClass} min-h-[72px] resize-y py-2`}
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            placeholder="Type a test message"
            rows={3}
            aria-label="Message text"
          />
        </label>

        {approvalRequired ? (
          <div className="rounded-md border border-[#ead6a2] bg-wago-warning-soft px-3 py-2 text-xs leading-5 text-[#6f5200]">
            This number is not allowed yet. Use <strong>Allow &amp; Send</strong> only after confirming recipient
            permission.
          </div>
        ) : null}

        <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
          <button className={`${primaryButtonClass} w-full sm:w-auto`} type="submit" disabled={!canSend}>
            {isSending ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />}
            {isSending ? "Sending" : "Send"}
          </button>

          {approvalRequired ? (
            <button
              className={`${secondaryButtonClass} w-full sm:w-auto`}
              type="button"
              onClick={onAllowAndSend}
              disabled={!canSend}
            >
              {isSending ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
              Allow &amp; Send
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
