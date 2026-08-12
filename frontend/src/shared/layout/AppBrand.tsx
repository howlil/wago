import { MessageCircleMore } from "lucide-react";

type AppBrandProps = {
  collapsed?: boolean;
};

export function AppBrand({ collapsed = false }: AppBrandProps) {
  return (
    <div className={`flex min-w-0 items-center ${collapsed ? "justify-center" : "gap-2.5"}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-wago-brand text-white">
        <MessageCircleMore size={16} strokeWidth={2.1} />
      </span>
      {!collapsed ? (
        <strong className="block truncate text-[14px] font-semibold tracking-[-0.02em] text-wago-ink">Wago</strong>
      ) : null}
    </div>
  );
}
