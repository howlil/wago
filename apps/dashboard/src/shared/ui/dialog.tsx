import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ComponentPropsWithoutRef } from "react";

function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const Dialog = DialogPrimitive.Root;
export const DialogClose = DialogPrimitive.Close;
export const DialogDescription = DialogPrimitive.Description;
export const DialogTitle = DialogPrimitive.Title;

type DialogContentProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Content>;

export function DialogContent({ className, ...props }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#10251f]/60 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        className={joinClasses(
          "fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-3rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-[#dce5e1] bg-white p-5 shadow-[0_24px_80px_rgb(16_37_31_/_24%)] outline-none",
          className,
        )}
        {...props}
      />
    </DialogPrimitive.Portal>
  );
}
