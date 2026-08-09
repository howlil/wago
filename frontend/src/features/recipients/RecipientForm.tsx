import { Loader2, UserPlus } from "lucide-react";
import type { FormEvent } from "react";
import { inputClass, primaryButtonClass } from "../../shared/ui/classes.js";

type RecipientFormProps = {
  phone: string;
  label: string;
  busy: boolean;
  onPhoneChange: (value: string) => void;
  onLabelChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function RecipientForm({ phone, label, busy, onPhoneChange, onLabelChange, onSubmit }: RecipientFormProps) {
  return (
    <form onSubmit={onSubmit} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
      <input
        className={inputClass}
        value={phone}
        onChange={(event) => onPhoneChange(event.target.value)}
        placeholder="628xxxxxxxxxx"
        aria-label="Recipient phone"
        autoComplete="tel"
      />
      <button className={primaryButtonClass} type="submit" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" size={14} /> : <UserPlus size={14} />}
        Allow
      </button>
      <input
        className={`${inputClass} sm:col-span-2`}
        value={label}
        onChange={(event) => onLabelChange(event.target.value)}
        placeholder="Label (optional)"
        aria-label="Recipient label"
      />
    </form>
  );
}
