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
    <form onSubmit={onSubmit} className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_auto] gap-2 max-[720px]:grid-cols-1">
      <input
        className={inputClass}
        value={phone}
        onChange={(event) => onPhoneChange(event.target.value)}
        placeholder="628xxxxxxxxxx"
        aria-label="Recipient phone"
        autoComplete="tel"
      />
      <input
        className={inputClass}
        value={label}
        onChange={(event) => onLabelChange(event.target.value)}
        placeholder="Label (optional)"
        aria-label="Recipient label"
      />
      <button className={primaryButtonClass} type="submit" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" size={14} /> : <UserPlus size={14} />}
        Allow
      </button>
    </form>
  );
}
