import { AlertTriangle, Link2Off, Loader2, X } from "lucide-react";
import { dangerButtonClass, secondaryButtonClass } from "../../shared/ui/classes.js";

type RebindSessionDialogProps = {
  isOpen: boolean;
  isRebinding: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function RebindSessionDialog({ isOpen, isRebinding, onCancel, onConfirm }: RebindSessionDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10251f]/60 px-4 py-6 backdrop-blur-[2px]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onCancel}
        disabled={isRebinding}
        aria-label="Close pairing dialog"
      />
      <section
        className="relative w-full max-w-[460px] rounded-xl border border-[#dce5e1] bg-white p-5 shadow-[0_24px_80px_rgb(16_37_31_/_24%)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pairing-dialog-title"
        aria-describedby="pairing-dialog-description"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#fff0f1] text-[#9c2932]">
              <AlertTriangle size={19} />
            </span>
            <div>
              <h2 id="pairing-dialog-title" className="text-lg font-semibold text-[#17231f]">
                Start a New Pairing Session?
              </h2>
              <p id="pairing-dialog-description" className="mt-1 text-sm leading-6 text-[#687970]">
                The current WhatsApp auth and binding will be cleared. Your App ID and API key stay the same.
              </p>
            </div>
          </div>
          <button
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#dce5e1] text-[#52675d] hover:bg-[#f4f7f5] disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={onCancel}
            disabled={isRebinding}
            aria-label="Close pairing dialog"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-6 flex justify-end gap-2 max-[520px]:flex-col-reverse">
          <button className={secondaryButtonClass} type="button" onClick={onCancel} disabled={isRebinding}>
            Cancel
          </button>
          <button
            className={`${dangerButtonClass} bg-[#9c2932] text-white hover:bg-[#842029]`}
            type="button"
            onClick={onConfirm}
            disabled={isRebinding}
          >
            {isRebinding ? <Loader2 className="animate-spin" size={17} /> : <Link2Off size={17} />}
            {isRebinding ? "Starting" : "Start new pairing"}
          </button>
        </div>
      </section>
    </div>
  );
}
