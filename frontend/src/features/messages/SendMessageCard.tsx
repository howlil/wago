import { Check, Loader2, Send } from "lucide-react";
import type { FormEvent } from "react";
import type { WhatsAppStatus } from "../../api.js";
import {
  cardBodyClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  sectionDescriptionClass,
  sectionTitleClass,
} from "../../shared/ui/classes.js";

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
    <section id="messaging" className={`${cardBodyClass} scroll-mt-28`}>
      <div>
        <h2 className={sectionTitleClass}>Send Message</h2>
        <p className={sectionDescriptionClass}>
          {status === "connected"
            ? "Send through the bound WhatsApp session. Recipient permission is enforced before delivery."
            : "Connect WhatsApp before sending messages."}
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-5 grid gap-4">
        <label>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.06em] text-[#5d7067]">Phone</span>
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
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.06em] text-[#5d7067]">Message</span>
          <textarea
            className={`${inputClass} min-h-32 resize-y`}
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            placeholder="Hello"
            rows={5}
            aria-label="Message text"
          />
        </label>

        {approvalRequired ? (
          <div className="rounded-xl border border-[#efdba4] bg-[#fff8e8] p-3.5 text-sm leading-6 text-[#795300]">
            This number is not allowed yet. Use <strong>Allow &amp; Send</strong> only when the recipient has given
            permission to receive outbound messages.
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button className={primaryButtonClass} type="submit" disabled={!canSend}>
            {isSending ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}
            {isSending ? "Sending" : "Send"}
          </button>

          {approvalRequired ? (
            <button className={secondaryButtonClass} type="button" onClick={onAllowAndSend} disabled={!canSend}>
              {isSending ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              Allow &amp; Send
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
