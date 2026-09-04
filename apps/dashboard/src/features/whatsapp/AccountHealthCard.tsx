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
      <section className="border-b border-wago-line py-4" aria-labelledby="account-health-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 id="account-health-title" className="m-0 text-xs font-semibold text-wago-ink">
            Account health
          </h3>
          <span className="text-xs font-medium text-wago-warning">Checking</span>
        </div>
        <p className="mb-0 mt-2 max-w-prose text-xs leading-5 text-wago-muted">
          Refreshing reach-out and new-chat restriction state.
        </p>
        <p className="mb-0 mt-1 text-[10px] text-wago-tertiary">
          Last checked {formatDate(accountHealth?.lastFetchedAt)}
        </p>
      </section>
    );
  }

  const availableHealth = accountHealth?.availability === "available" ? accountHealth : undefined;

  if (!availableHealth) {
    return (
      <section className="border-b border-wago-line py-4" aria-labelledby="account-health-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 id="account-health-title" className="m-0 text-xs font-semibold text-wago-ink">
            Account health
          </h3>
          <span className="text-xs font-medium text-wago-muted">Unavailable</span>
        </div>
        <p className="mb-0 mt-2 max-w-prose text-xs leading-5 text-wago-muted">
          {unavailableDescription(accountHealth?.unavailableReason)}
        </p>
        <p className="mb-0 mt-1 text-[10px] text-wago-tertiary">
          Last checked {formatDate(accountHealth?.lastFetchedAt)}
        </p>
      </section>
    );
  }

  const reachout = availableHealth.reachoutTimeLock;
  const capacity = availableHealth.newChatCapacity;
  const reachoutRestricted = Boolean(reachout?.isActive);
  const capRestricted = capacity.status === "capped";
  const capWarning = capacity.status === "warning";
  const showQuota = typeof capacity.total === "number" && capacity.total > 0;
  const overallLimited = reachoutRestricted || capRestricted;
  const overallWarning = !overallLimited && capWarning;

  return (
    <section className="border-b border-wago-line py-4" aria-labelledby="account-health-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 id="account-health-title" className="m-0 text-xs font-semibold text-wago-ink">
          Account health
        </h3>
        <span
          className={`text-xs font-semibold ${
            overallLimited || overallWarning ? "text-wago-warning" : "text-wago-positive"
          }`}
        >
          {overallLimited ? "Limited" : overallWarning ? "Warning" : "Available"}
        </span>
      </div>

      <dl className="mb-0 mt-3 grid gap-4 md:grid-cols-3 md:gap-0 md:divide-x md:divide-wago-line">
        <div className="min-w-0 md:pr-4">
          <dt className="text-[11px] font-medium text-wago-secondary">Reach-out</dt>
          <dd
            className={`mb-0 mt-1 text-[13px] font-semibold ${reachoutRestricted ? "text-wago-warning" : "text-wago-positive"}`}
          >
            {reachoutRestricted ? "Limited" : "Available"}
          </dd>
          <p className="mb-0 mt-1 text-xs leading-5 text-wago-muted">
            {reachoutRestricted
              ? "New recipients are blocked while the timelock is active."
              : "No reach-out timelock is active."}
          </p>
          {reachoutRestricted && reachout?.retryAt ? (
            <p className="mb-0 mt-1 text-xs font-medium text-wago-warning">
              Retry new chats after {formatDate(reachout.retryAt)}
            </p>
          ) : null}
        </div>

        <div className="min-w-0 border-t border-wago-line pt-4 md:border-t-0 md:px-4 md:pt-0">
          <dt className="text-[11px] font-medium text-wago-secondary">New chats</dt>
          <dd
            className={`mb-0 mt-1 text-[13px] font-semibold ${
              capRestricted || capWarning ? "text-wago-warning" : "text-wago-positive"
            }`}
          >
            {capRestricted ? "Capped" : capWarning ? "Warning" : capacity.status === "unknown" ? "Unknown" : "Normal"}
          </dd>
          <p className="mb-0 mt-1 text-xs leading-5 text-wago-muted">
            {capRestricted
              ? "WhatsApp has capped new-recipient sends; known recipients are evaluated normally."
              : capWarning
                ? "WhatsApp reports capacity pressure. New-recipient sends remain allowed until a cap is reported."
                : capacity.status === "unknown"
                  ? "WhatsApp has not reported a new-chat capacity state."
                  : "No new-chat warning or cap is reported."}
          </p>
          {showQuota ? (
            <p className="mb-0 mt-1 text-[10px] text-wago-tertiary">
              {capacity.used ?? 0} / {capacity.total} used
            </p>
          ) : null}
          {capacity.cycleEndAt ? (
            <p className="mb-0 mt-1 text-[10px] text-wago-tertiary">Cycle ends {formatDate(capacity.cycleEndAt)}</p>
          ) : null}
        </div>

        <div className="min-w-0 border-t border-wago-line pt-4 md:border-t-0 md:pl-4 md:pt-0">
          <dt className="text-[11px] font-medium text-wago-secondary">Last checked</dt>
          <dd className="mb-0 mt-1 text-xs font-medium text-wago-ink">{formatDate(availableHealth.lastFetchedAt)}</dd>
        </div>
      </dl>
    </section>
  );
}
