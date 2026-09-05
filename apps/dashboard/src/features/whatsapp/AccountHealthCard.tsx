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
      <section className="border-b border-wago-workspace-line py-3" aria-labelledby="account-health-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="account-health-title" className="m-0 text-xs font-semibold text-wago-ink">
            Account health
          </h3>
          <span className="text-[11px] font-medium text-wago-warning">Checking</span>
        </div>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="mb-0 max-w-prose text-xs leading-4 text-wago-muted">
            Refreshing reach-out and new-chat restriction state.
          </p>
          <p className="mb-0 text-[10px] text-wago-tertiary">Last checked {formatDate(accountHealth?.lastFetchedAt)}</p>
        </div>
      </section>
    );
  }

  const availableHealth = accountHealth?.availability === "available" ? accountHealth : undefined;

  if (!availableHealth) {
    return (
      <section className="border-b border-wago-workspace-line py-3" aria-labelledby="account-health-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="account-health-title" className="m-0 text-xs font-semibold text-wago-ink">
            Account health
          </h3>
          <span className="text-[11px] font-medium text-wago-muted">Unavailable</span>
        </div>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="mb-0 max-w-prose text-xs leading-4 text-wago-muted">
            {unavailableDescription(accountHealth?.unavailableReason)}
          </p>
          <p className="mb-0 text-[10px] text-wago-tertiary">Last checked {formatDate(accountHealth?.lastFetchedAt)}</p>
        </div>
      </section>
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
    <section className="border-b border-wago-workspace-line py-3" aria-labelledby="account-health-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="account-health-title" className="m-0 text-xs font-semibold text-wago-ink">
          Account health
        </h3>
        <span className={`text-[11px] font-semibold ${overallLimited ? "text-wago-warning" : "text-wago-positive"}`}>
          {overallLimited ? "Limited" : "Available"}
        </span>
      </div>

      <dl className="mb-0 mt-2 grid gap-3 md:grid-cols-3 md:gap-0 md:divide-x md:divide-wago-workspace-line">
        <div className="min-w-0 md:pr-3">
          <dt className="text-[10px] font-medium uppercase tracking-[0.04em] text-wago-secondary">Reach-out</dt>
          <dd
            className={`mb-0 mt-0.5 text-xs font-semibold ${reachoutRestricted ? "text-wago-warning" : "text-wago-positive"}`}
          >
            {reachoutRestricted ? "Limited" : "Available"}
          </dd>
          <p className="mb-0 mt-0.5 text-[11px] leading-4 text-wago-muted">
            {reachoutRestricted
              ? "New recipients are blocked while the timelock is active."
              : "No reach-out timelock is active."}
          </p>
          {reachoutRestricted && reachout?.retryAt ? (
            <p className="mb-0 mt-0.5 text-[11px] font-medium text-wago-warning">
              Retry new chats after {formatDate(reachout.retryAt)}
            </p>
          ) : null}
        </div>

        <div className="min-w-0 border-t border-wago-workspace-line pt-3 md:border-t-0 md:px-3 md:pt-0">
          <dt className="text-[10px] font-medium uppercase tracking-[0.04em] text-wago-secondary">New chats</dt>
          <dd
            className={`mb-0 mt-0.5 text-xs font-semibold ${capRestricted || capWarning ? "text-wago-warning" : "text-wago-positive"}`}
          >
            {capRestricted ? "Capped" : capWarning ? cap?.capping_status : "Normal"}
          </dd>
          <p className="mb-0 mt-0.5 text-[11px] leading-4 text-wago-muted">
            {capRestricted || capWarning
              ? "New-recipient sends are paused; known recipients are evaluated normally."
              : "No new-chat warning or cap is reported."}
          </p>
          {showQuota ? (
            <p className="mb-0 mt-0.5 text-[10px] text-wago-tertiary">
              {cap?.used_quota ?? 0} / {cap?.total_quota} used
            </p>
          ) : null}
        </div>

        <div className="min-w-0 border-t border-wago-workspace-line pt-3 md:border-t-0 md:pl-3 md:pt-0">
          <dt className="text-[10px] font-medium uppercase tracking-[0.04em] text-wago-secondary">Last checked</dt>
          <dd className="mb-0 mt-0.5 text-[11px] font-medium text-wago-ink">
            {formatDate(availableHealth.lastFetchedAt)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
