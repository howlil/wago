import { AlertTriangle, KeyRound, Loader2, X } from "lucide-react";
import { dangerButtonClass, secondaryButtonClass } from "../../shared/ui/classes.js";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../shared/ui/dialog.js";

type RotateApiKeyDialogProps = {
  isOpen: boolean;
  isRotating: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function RotateApiKeyDialog({ isOpen, isRotating, onCancel, onConfirm }: RotateApiKeyDialogProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isRotating) {
          onCancel();
        }
      }}
    >
      <DialogContent
        className="max-w-[480px]"
        onEscapeKeyDown={(event) => {
          if (isRotating) {
            event.preventDefault();
          }
        }}
        onPointerDownOutside={(event) => {
          if (isRotating) {
            event.preventDefault();
          }
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#fff0f1] text-[#9c2932]">
              <AlertTriangle size={19} />
            </span>
            <div>
              <DialogTitle className="text-lg font-semibold text-[#17231f]">Rotate API key?</DialogTitle>
              <DialogDescription className="mt-1 text-sm leading-6 text-[#687970]">
                The current machine API key becomes invalid immediately. Other dashboard sessions are revoked; this
                browser remains signed in so you can save the new key. WhatsApp auth is unchanged.
              </DialogDescription>
            </div>
          </div>
          <DialogClose asChild>
            <button
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#dce5e1] text-[#52675d] hover:bg-[#f4f7f5] disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              disabled={isRotating}
              aria-label="Close API key rotation dialog"
            >
              <X size={16} />
            </button>
          </DialogClose>
        </div>

        <div className="mt-6 flex justify-end gap-2 max-[520px]:flex-col-reverse">
          <DialogClose asChild>
            <button className={secondaryButtonClass} type="button" disabled={isRotating}>
              Cancel
            </button>
          </DialogClose>
          <button
            className={`${dangerButtonClass} bg-[#9c2932] text-white hover:bg-[#842029]`}
            type="button"
            onClick={onConfirm}
            disabled={isRotating}
          >
            {isRotating ? <Loader2 className="animate-spin" size={17} /> : <KeyRound size={17} />}
            {isRotating ? "Rotating" : "Rotate and revoke other sessions"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
