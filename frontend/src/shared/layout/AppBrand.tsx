import { MessageCircleMore } from "lucide-react";

type AppBrandProps = {
  collapsed?: boolean;
};

export function AppBrand({ collapsed = false }: AppBrandProps) {
  return (
    <div className={`flex min-w-0 items-center ${collapsed ? "justify-center" : "gap-2.5"}`}>
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#1d7a58] via-wago-brand to-[#0f4f39] text-white shadow-[0_6px_18px_rgba(23,107,77,0.22)]">
        <span className="absolute inset-x-1 top-0 h-px bg-white/45" />
        <MessageCircleMore size={18} strokeWidth={2.2} />
      </span>
      {!collapsed ? (
        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-1.5">
            <strong className="block truncate text-[14px] font-bold tracking-[-0.025em] text-wago-ink">Wago</strong>
            <span className="rounded-full bg-wago-brand-soft px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-wago-brand-strong">
              OSS
            </span>
          </div>
          <span className="mt-0.5 block truncate text-[10px] font-medium text-wago-muted">WhatsApp gateway</span>
        </div>
      ) : null}
    </div>
  );
}
