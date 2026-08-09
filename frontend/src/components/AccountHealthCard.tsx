import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import type { AccountHealthSnapshot } from "../api.js";

type AccountHealthCardProps = {
  accountHealth?: AccountHealthSnapshot;
};

function formatDate(value?: string): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function AccountHealthCard({ accountHealth }: AccountHealthCardProps) {
  const reachout = accountHealth?.reachoutTimeLock;
  const cap = accountHealth?.newChatCap;
  const restricted = Boolean(reachout?.isActive) || cap?.capping_status === "CAPPED";
  const warning = cap?.capping_status === "FIRST_WARNING" || cap?.capping_status === "SECOND_WARNING";

  return (
    <section className="mt-4 rounded-lg border border-[#d9e3df] bg-white p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#edf6f2] text-[#176b55]">
          {restricted || warning ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
        </span>
        <div>
          <h2 className="mb-1 text-xl">Account Health</h2>
          <p className="m-0 text-sm text-[#667972]">
            WhatsApp reach-out restrictions and new-chat capacity reported by Baileys.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 max-[680px]:grid-cols-1">
        <div className="rounded-lg bg-[#f7faf9] p-3.5">
          <span className="block text-xs font-bold uppercase text-[#667972]">Reach-out</span>
          <strong className={`mt-1 block ${reachout?.isActive ? "text-[#a12d35]" : "text-[#176b55]"}`}>
            {reachout?.isActive ? "Restricted" : "Available"}
          </strong>
          {reachout?.retryAt ? (
            <span className="mt-1 block text-xs text-[#667972]">Retry after {formatDate(reachout.retryAt)}</span>
          ) : null}
          {reachout?.enforcementType ? (
            <span className="mt-1 block text-xs text-[#667972]">{reachout.enforcementType}</span>
          ) : null}
        </div>

        <div className="rounded-lg bg-[#f7faf9] p-3.5">
          <span className="block text-xs font-bold uppercase text-[#667972]">New chats</span>
          <strong
            className={`mt-1 block ${
              cap?.capping_status === "CAPPED" ? "text-[#a12d35]" : warning ? "text-[#8a5a00]" : "text-[#176b55]"
            }`}
          >
            {cap?.capping_status ?? "No cap reported"}
          </strong>
          {cap?.total_quota != null ? (
            <span className="mt-1 block text-xs text-[#667972]">
              {cap.used_quota ?? 0} / {cap.total_quota} used
            </span>
          ) : null}
          {cap?.cycle_end_timestamp ? (
            <span className="mt-1 block text-xs text-[#667972]">Cycle ends {formatDate(cap.cycle_end_timestamp)}</span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#667972]">
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 size={14} /> Last checked: {formatDate(accountHealth?.lastFetchedAt)}
        </span>
        {accountHealth?.lastFetchErrorAt ? (
          <span className="text-[#8a5a00]">Last health fetch error: {formatDate(accountHealth.lastFetchErrorAt)}</span>
        ) : null}
      </div>
    </section>
  );
}
