import { AlertTriangle, Link2Off, Loader2, X } from "lucide-react";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1f2a32]/55 px-4 py-6">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onCancel}
        disabled={isRebinding}
        aria-label="Close pairing dialog"
      />
      <section
        className="relative w-full max-w-[460px] rounded-lg border border-[#d9e3df] bg-white p-5 shadow-[0_18px_48px_rgb(31_42_50_/_22%)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pairing-dialog-title"
        aria-describedby="pairing-dialog-description"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f8d7da] text-[#842029]">
              <AlertTriangle size={20} />
            </span>
            <div>
              <h2 id="pairing-dialog-title" className="mb-1 text-xl">
                Start a New Pairing Session?
              </h2>
              <p id="pairing-dialog-description" className="m-0 text-sm text-[#667972]">
                The current WhatsApp session will be cleared. You will need to scan a new QR code.
              </p>
            </div>
          </div>
          <button
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#d9e3df] text-[#405149] disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={onCancel}
            disabled={isRebinding}
            aria-label="Close pairing dialog"
          >
            <X size={17} />
          </button>
        </div>

        <div className="mt-5 flex justify-end gap-3 max-[520px]:flex-col-reverse">
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#cdd9d5] bg-white px-3.5 text-[#1f2a32] disabled:cursor-not-allowed disabled:bg-[#eef3f1] disabled:text-[#667972]"
            type="button"
            onClick={onCancel}
            disabled={isRebinding}
          >
            Cancel
          </button>
          <button
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#842029] px-3.5 text-white disabled:cursor-not-allowed disabled:bg-[#d7a1a8] disabled:text-[#fff4f5]"
            type="button"
            onClick={onConfirm}
            disabled={isRebinding}
          >
            {isRebinding ? <Loader2 className="animate-spin" size={18} /> : <Link2Off size={18} />}
            <span>{isRebinding ? "Starting" : "Start new pairing"}</span>
          </button>
        </div>
      </section>
    </div>
  );
}
