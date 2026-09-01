import { AlertTriangle, Link2Off, Loader2, X } from "lucide-react";
import { dangerButtonClass, secondaryButtonClass } from "../../shared/ui/classes.js";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../shared/ui/dialog.js";

type RebindSessionDialogProps = {
  isOpen: boolean;
  isRebinding: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function RebindSessionDialog({ isOpen, isRebinding, onCancel, onConfirm }: RebindSessionDialogProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isRebinding) {
          onCancel();
        }
      }}
    >
      <DialogContent
        className="max-w-[460px]"
        onEscapeKeyDown={(event) => {
          if (isRebinding) {
            event.preventDefault();
          }
        }}
        onPointerDownOutside={(event) => {
          if (isRebinding) {
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
              <DialogTitle className="text-lg font-semibold text-[#17231f]">Start a New Pairing Session?</DialogTitle>
              <DialogDescription className="mt-1 text-sm leading-6 text-[#687970]">
                The current WhatsApp auth and binding will be cleared. Your App ID and API key stay the same.
              </DialogDescription>
            </div>
          </div>
          <DialogClose asChild>
            <button
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#dce5e1] text-[#52675d] hover:bg-[#f4f7f5] disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              disabled={isRebinding}
              aria-label="Close pairing dialog"
            >
              <X size={16} />
            </button>
          </DialogClose>
        </div>

        <div className="mt-6 flex justify-end gap-2 max-[520px]:flex-col-reverse">
          <DialogClose asChild>
            <button className={secondaryButtonClass} type="button" disabled={isRebinding}>
              Cancel
            </button>
          </DialogClose>
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
      </DialogContent>
    </Dialog>
  );
}
