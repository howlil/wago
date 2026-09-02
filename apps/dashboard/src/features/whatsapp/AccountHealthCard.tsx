import type { AccountHealthSnapshot, AccountHealthUnavailableReason } from "./api.js";

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

function unavailableDescription(reason?: AccountHealthUnavailableReason): string {
  if (reason === "session_invalid") {
    return "The linked session is no longer valid. Pair WhatsApp again to restore account health.";
  }
  if (reason === "fetch_failed") {
    return "The latest account-health check failed. Retry after the connection is stable.";
  }
  if (reason === "not_connected") {
    return "Connect WhatsApp to check account restrictions.";
  }
  return "Account health is unavailable until the connected session is checked.";
}

export function AccountHealthCard({ accountHealth }: AccountHealthCardProps) {
  const availability = accountHealth?.availability ?? "unavailable";

  if (availability === "checking") {
    return (
      <div className="mt-4 border-t border-wago-line pt-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="m-0 text-xs font-semibold text-wago-ink">Account health</h3>
            <p className="mb-0 mt-0.5 text-[11px] leading-4 text-wago-muted">WhatsApp restriction state.</p>
          </div>
          <span className="text-[11px] font-medium text-wago-warning">Checking account health</span>
        </div>
        <p className="mb-0 mt-2 text-[11px] leading-5 text-wago-muted">
          Refreshing reach-out and new-chat restriction state.
        </p>
        <p className="mb-0 mt-1 text-[9px] text-[#87918c]">Last checked {formatDate(accountHealth?.lastFetchedAt)}</p>
      </div>
    );
  }

  const availableHealth = accountHealth?.availability === "available" ? accountHealth : undefined;

  if (!availableHealth) {
    return (
      <div className="mt-4 border-t border-wago-line pt-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="m-0 text-xs font-semibold text-wago-ink">Account health</h3>
            <p className="mb-0 mt-0.5 text-[11px] leading-4 text-wago-muted">WhatsApp restriction state.</p>
          </div>
          <span className="text-[11px] font-medium text-wago-muted">Health unavailable</span>
        </div>
        <p className="mb-0 mt-2 text-[11px] leading-5 text-wago-muted">
          {unavailableDescription(accountHealth?.unavailableReason)}
        </p>
        <p className="mb-0 mt-1 text-[9px] text-[#87918c]">Last checked {formatDate(accountHealth?.lastFetchedAt)}</p>
      </div>
    );
  }

  const reachout = availableHealth.reachoutTimeLock;
  const cap = availableHealth.newChatCap;
  const reachoutRestricted = Boolean(reachout?.isActive);
  const capRestricted = cap?.capping_status === "CAPPED";
  const capWarning = cap?.capping_status === "FIRST_WARNING" || cap?.capping_status === "SECOND_WARNING";
  const showQuota = typeof cap?.total_quota === "number" && cap.total_quota > 0;
  const overallLimited = reachoutRestricted || capRestricted || capWarning;

  return (
    <div className="mt-4 border-t border-wago-line pt-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="m-0 text-xs font-semibold text-wago-ink">Account health</h3>
          <p className="mb-0 mt-0.5 text-[11px] leading-4 text-wago-muted">WhatsApp restriction state.</p>
        </div>
        <span className={`text-[11px] font-semibold ${overallLimited ? "text-wago-warning" : "text-wago-brand"}`}>
          {overallLimited ? "Limited" : "Available"}
        </span>
      </div>

      <dl className="mb-0 mt-2 divide-y divide-wago-line border-y border-wago-line">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 py-2.5">
          <dt className="text-[11px] font-medium text-[#52615a]">Reach-out</dt>
          <dd
            className={`mb-0 text-[11px] font-semibold ${reachoutRestricted ? "text-wago-warning" : "text-wago-brand"}`}
          >
            {reachoutRestricted ? "Limited" : "Available"}
          </dd>
          <p className="col-span-2 mb-0 text-[10px] leading-4 text-[#7c8781]">
            {reachoutRestricted
              ? "New recipients are blocked while the timelock is active."
              : "No reach-out timelock is active."}
          </p>
          {reachoutRestricted && reachout?.retryAt ? (
            <p className="col-span-2 mb-0 text-[10px] font-medium text-wago-warning">
              Retry new chats after {formatDate(reachout.retryAt)}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 py-2.5">
          <dt className="text-[11px] font-medium text-[#52615a]">New chats</dt>
          <dd
            className={`mb-0 text-[11px] font-semibold ${capRestricted || capWarning ? "text-wago-warning" : "text-wago-brand"}`}
          >
            {capRestricted ? "Capped" : capWarning ? cap?.capping_status : "Normal"}
          </dd>
          <p className="col-span-2 mb-0 text-[10px] leading-4 text-[#7c8781]">
            {capRestricted || capWarning
              ? "New-recipient sends are paused; known recipients are evaluated normally."
              : "No new-chat warning or cap is reported."}
          </p>
          {showQuota ? (
            <p className="col-span-2 mb-0 text-[10px] text-[#7c8781]">
              {cap?.used_quota ?? 0} / {cap?.total_quota} used
            </p>
          ) : null}
        </div>
      </dl>

      <p className="mb-0 mt-1.5 text-[9px] text-[#87918c]">Last checked {formatDate(availableHealth.lastFetchedAt)}</p>
    </div>
  );
}
