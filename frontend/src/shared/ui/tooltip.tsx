import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";

export const TooltipProvider = TooltipPrimitive.Provider;

type TooltipProps = {
  children: ReactElement;
  content: ReactNode;
  side?: ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>["side"];
};

export function Tooltip({ children, content, side = "right" }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-[60] rounded-md bg-[#17231f] px-2 py-1 text-[11px] font-medium text-white shadow-lg"
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-[#17231f]" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
