import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import type { AccountHealthSnapshot } from "../../api.js";
import { cardBodyClass, sectionDescriptionClass, sectionTitleClass } from "../../shared/ui/classes.js";

type AccountHealthCardProps = {
  accountHealth?: AccountHealthSnapshot;
};

function parseTimestamp(value?: string): Date | null {
  if (!value) {
    return null;
  }

  const numeric = Number(value);
  const date =
    Number.isFinite(numeric) && /^\d+(?:\.\d+)?$/.test(value.trim())
      ? new Date(numeric < 1_000_000_000_000 ? numeric * 1000 : numeric)
      : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value?: string): string {
  const date = parseTimestamp(value);
  return date ? date.toLocaleString() : "—";
}

export function AccountHealthCard({ accountHealth }: AccountHealthCardProps) {
  const reachout = accountHealth?.reachoutTimeLock;
  const cap = accountHealth?.newChatCap;
  const reachoutRestricted = Boolean(reachout?.isActive);
  const capRestricted = cap?.capping_status === "CAPPED";
  const capWarning = cap?.capping_status === "FIRST_WARNING" || cap?.capping_status === "SECOND_WARNING";
  const hasWarning = reachoutRestricted || capRestricted || capWarning;
  const showQuota = typeof cap?.total_quota === "number" && cap.total_quota > 0;

  return (
    <section className={cardBodyClass}>
      <div className="mb-5 flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            hasWarning ? "bg-[#fff5dc] text-[#8a5a00]" : "bg-[#e9f4ef] text-[#176b55]"
          }`}
        >
          {hasWarning ? <AlertTriangle size={19} /> : <ShieldCheck size={19} />}
        </span>
        <div>
          <h2 className={sectionTitleClass}>Account Health</h2>
          <p className={sectionDescriptionClass}>Outbound restrictions reported by the connected WhatsApp session.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-[#f5f8f6] p-4">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#718179]">Reach-out</span>
          <strong className={`mt-1.5 block text-sm ${reachoutRestricted ? "text-[#916000]" : "text-[#176b55]"}`}>
            {reachoutRestricted ? "New reach-outs restricted" : "Available"}
          </strong>
          <p className="mb-0 mt-2 text-xs leading-5 text-[#718179]">
            {reachoutRestricted
              ? "Wago blocks only recipients it considers new while this timelock is active. Existing recipients are not globally blocked."
              : "No active reach-out timelock is reported."}
          </p>
          {reachoutRestricted && reachout?.retryAt ? (
            <span className="mt-2 block text-xs font-medium text-[#916000]">
              Retry new chats after {formatDate(reachout.retryAt)}
            </span>
          ) : null}
          {reachout?.enforcementType ? (
            <span className="mt-1 block break-all font-mono text-[10px] text-[#87958f]">
              {reachout.enforcementType}
            </span>
          ) : null}
        </div>

        <div className="rounded-xl bg-[#f5f8f6] p-4">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#718179]">New chats</span>
          <strong
            className={`mt-1.5 block text-sm ${capRestricted || capWarning ? "text-[#916000]" : "text-[#176b55]"}`}
          >
            {capRestricted ? "Capped" : capWarning ? cap?.capping_status : "No active cap"}
          </strong>
          <p className="mb-0 mt-2 text-xs leading-5 text-[#718179]">
            {capRestricted
              ? "New-recipient sends are paused. Existing recipients are not blocked by this cap."
              : capWarning
                ? "New-recipient sends are paused conservatively while WhatsApp reports this warning."
                : "No new-chat warning or cap is currently reported."}
          </p>
          {showQuota ? (
            <span className="mt-2 block text-xs text-[#718179]">
              {cap?.used_quota ?? 0} / {cap?.total_quota} used
            </span>
          ) : null}
          {cap?.cycle_end_timestamp ? (
            <span className="mt-1 block text-xs text-[#718179]">Cycle ends {formatDate(cap.cycle_end_timestamp)}</span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#718179]">
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 size={14} /> Last checked: {formatDate(accountHealth?.lastFetchedAt)}
        </span>
        {accountHealth?.lastFetchErrorAt ? (
          <span className="text-[#916000]">Last fetch error: {formatDate(accountHealth.lastFetchErrorAt)}</span>
        ) : null}
      </div>
    </section>
  );
}
