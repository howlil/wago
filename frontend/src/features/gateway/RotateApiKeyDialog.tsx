import { AlertTriangle, KeyRound, Loader2, X } from "lucide-react";
import { dangerButtonClass, secondaryButtonClass } from "../../shared/ui/classes.js";

type RotateApiKeyDialogProps = { isOpen: boolean; isRotating: boolean; onCancel: () => void; onConfirm: () => void };
export function RotateApiKeyDialog({ isOpen, isRotating, onCancel, onConfirm }: RotateApiKeyDialogProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10251f]/60 px-4 py-6 backdrop-blur-[2px]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onCancel}
        disabled={isRotating}
        aria-label="Close API key rotation dialog"
      />
      <section
        className="relative w-full max-w-[480px] rounded-xl border border-[#dce5e1] bg-white p-5 shadow-[0_24px_80px_rgb(16_37_31_/_24%)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-key-rotation-dialog-title"
        aria-describedby="api-key-rotation-dialog-description"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#fff0f1] text-[#9c2932]">
              <AlertTriangle size={19} />
            </span>
            <div>
              <h2 id="api-key-rotation-dialog-title" className="text-lg font-semibold text-[#17231f]">
                Rotate API key?
              </h2>
              <p id="api-key-rotation-dialog-description" className="mt-1 text-sm leading-6 text-[#687970]">
                The current machine API key becomes invalid immediately. Other dashboard sessions are revoked; this
                browser remains signed in so you can save the new key. WhatsApp auth is unchanged.
              </p>
            </div>
          </div>
          <button
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#dce5e1] text-[#52675d] hover:bg-[#f4f7f5] disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={onCancel}
            disabled={isRotating}
            aria-label="Close API key rotation dialog"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mt-6 flex justify-end gap-2 max-[520px]:flex-col-reverse">
          <button className={secondaryButtonClass} type="button" onClick={onCancel} disabled={isRotating}>
            Cancel
          </button>
          <button
            className={`${dangerButtonClass} bg-[#9c2932] text-white hover:bg-[#842029]`}
            type="button"
            onClick={onConfirm}
            disabled={isRotating}
          >
            {isRotating ? <Loader2 className="animate-spin" size={17} /> : <KeyRound size={17} />}{" "}
            {isRotating ? "Rotating" : "Rotate and revoke other sessions"}
          </button>
        </div>
      </section>
    </div>
  );
}
