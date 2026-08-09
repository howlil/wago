import { AlertTriangle, Link2Off, Loader2, X } from "lucide-react";
import { useLayoutEffect, useState } from "react";

type RebindSessionDialogProps = {
  isOpen: boolean;
  isRebinding: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

const confirmationText = "RE BIND";

export function RebindSessionDialog({ isOpen, isRebinding, onCancel, onConfirm }: RebindSessionDialogProps) {
  const [confirmation, setConfirmation] = useState("");

  useLayoutEffect(() => {
    if (isOpen) {
      setConfirmation("");
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const canConfirm = confirmation === confirmationText && !isRebinding;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1f2a32]/55 px-4 py-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isRebinding) {
          onCancel();
        }
      }}
    >
      <section
        className="w-full max-w-[460px] rounded-lg border border-[#d9e3df] bg-white p-5 shadow-[0_18px_48px_rgb(31_42_50_/_22%)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rebind-dialog-title"
        aria-describedby="rebind-dialog-description"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f8d7da] text-[#842029]">
              <AlertTriangle size={20} />
            </span>
            <div>
              <h2 id="rebind-dialog-title" className="mb-1 text-xl">
                Bind Another Account
              </h2>
              <p id="rebind-dialog-description" className="m-0 text-sm text-[#667972]">
                Current WhatsApp session will be logged out and local auth files will be deleted.
              </p>
            </div>
          </div>
          <button
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#d9e3df] text-[#405149] disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={onCancel}
            disabled={isRebinding}
            aria-label="Close rebind dialog"
          >
            <X size={17} />
          </button>
        </div>

        <label className="mt-5 block">
          <span className="mb-1.5 block text-sm font-bold text-[#405149]">Type RE BIND to continue</span>
          <input
            className="w-full rounded-lg border border-[#cdd9d5] bg-white px-3 py-2.5 text-[#1f2a32] outline-none focus:border-[#2f8f71] focus:ring-3 focus:ring-[#cde9df]"
            value={confirmation}
            onInput={(event) => setConfirmation(event.currentTarget.value)}
            placeholder={confirmationText}
            autoComplete="off"
            autoFocus
          />
        </label>

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
            disabled={!canConfirm}
          >
            {isRebinding ? <Loader2 className="animate-spin" size={18} /> : <Link2Off size={18} />}
            <span>{isRebinding ? "Rebinding" : "Rebind session"}</span>
          </button>
        </div>
      </section>
    </div>
  );
}
