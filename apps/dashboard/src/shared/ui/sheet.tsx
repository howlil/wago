import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ComponentPropsWithoutRef } from "react";

function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const Sheet = DialogPrimitive.Root;
export const SheetClose = DialogPrimitive.Close;
export const SheetDescription = DialogPrimitive.Description;
export const SheetTitle = DialogPrimitive.Title;

type SheetContentProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Content>;

export function SheetContent({ className, ...props }: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#10251d]/35 lg:hidden" />
      <DialogPrimitive.Content
        className={joinClasses(
          "fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-wago-line bg-white shadow-2xl outline-none lg:hidden",
          className,
        )}
        {...props}
      />
    </DialogPrimitive.Portal>
  );
}
