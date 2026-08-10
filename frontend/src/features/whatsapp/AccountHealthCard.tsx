import type { AccountHealthSnapshot, AccountHealthUnavailableReason } from "../../api.js";
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
      <section className={cardBodyClass}>
        <h2 className={sectionTitleClass}>Account health</h2>
        <p className={sectionDescriptionClass}>Restrictions reported by the current WhatsApp session.</p>
        <div className="mt-3 rounded-xl border border-[#dce4e0] bg-[#f7f9f8] px-4 py-4">
          <strong className="block text-xs font-semibold text-[#4d5b54]">Checking account health</strong>
          <p className="mb-0 mt-1 text-[11px] leading-5 text-wago-muted">
            Refreshing WhatsApp reach-out and new-chat restriction state.
          </p>
        </div>
        <p className="mb-0 mt-2 text-[9px] text-[#87918c]">Last checked {formatDate(accountHealth?.lastFetchedAt)}</p>
      </section>
    );
  }

  if (availability !== "available") {
    return (
      <section className={cardBodyClass}>
        <h2 className={sectionTitleClass}>Account health</h2>
        <p className={sectionDescriptionClass}>Restrictions reported by the current WhatsApp session.</p>
        <div className="mt-3 rounded-xl border border-[#e5ddd0] bg-[#fbf8f2] px-4 py-4">
          <strong className="block text-xs font-semibold text-[#705f42]">Health unavailable</strong>
          <p className="mb-0 mt-1 text-[11px] leading-5 text-[#776b58]">
            {unavailableDescription(accountHealth?.unavailableReason)}
          </p>
        </div>
        <p className="mb-0 mt-2 text-[9px] text-[#87918c]">Last checked {formatDate(accountHealth?.lastFetchedAt)}</p>
      </section>
    );
  }

  const reachout = accountHealth.reachoutTimeLock;
  const cap = accountHealth.newChatCap;
  const reachoutRestricted = Boolean(reachout?.isActive);
  const capRestricted = cap?.capping_status === "CAPPED";
  const capWarning = cap?.capping_status === "FIRST_WARNING" || cap?.capping_status === "SECOND_WARNING";
  const showQuota = typeof cap?.total_quota === "number" && cap.total_quota > 0;

  return (
    <section className={cardBodyClass}>
      <h2 className={sectionTitleClass}>Account health</h2>
      <p className={sectionDescriptionClass}>Restrictions reported by the current WhatsApp session.</p>

      <dl className="mb-0 mt-3 divide-y divide-[#e7ebe8] border-y border-[#e7ebe8]">
        <div className="py-2.5">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[11px] font-medium text-[#52615a]">Reach-out</dt>
            <dd
              className={`mb-0 text-[11px] font-semibold ${reachoutRestricted ? "text-wago-warning" : "text-wago-brand"}`}
            >
              {reachoutRestricted ? "Limited" : "Available"}
            </dd>
          </div>
          <p className="mb-0 mt-0.5 text-[10px] leading-4 text-[#7c8781]">
            {reachoutRestricted
              ? "Only new recipients are blocked while this timelock is active."
              : "No reach-out timelock is active."}
          </p>
          {reachoutRestricted && reachout?.retryAt ? (
            <p className="mb-0 mt-1 text-[10px] font-medium text-wago-warning">
              Retry new chats after {formatDate(reachout.retryAt)}
            </p>
          ) : null}
        </div>

        <div className="py-2.5">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[11px] font-medium text-[#52615a]">New chats</dt>
            <dd
              className={`mb-0 text-[11px] font-semibold ${capRestricted || capWarning ? "text-wago-warning" : "text-wago-brand"}`}
            >
              {capRestricted ? "Capped" : capWarning ? cap?.capping_status : "Normal"}
            </dd>
          </div>
          <p className="mb-0 mt-0.5 text-[10px] leading-4 text-[#7c8781]">
            {capRestricted || capWarning
              ? "New-recipient sends are paused; known recipients are evaluated normally."
              : "No new-chat warning or cap is reported."}
          </p>
          {showQuota ? (
            <p className="mb-0 mt-1 text-[10px] text-[#7c8781]">
              {cap?.used_quota ?? 0} / {cap?.total_quota} used
            </p>
          ) : null}
        </div>
      </dl>

      <p className="mb-0 mt-2 text-[9px] text-[#87918c]">Last checked {formatDate(accountHealth.lastFetchedAt)}</p>
    </section>
  );
}
