import type { ActivityCategory, ActivityEvent, ActivityLevel, AuditSource } from "./api.js";

const categoryLabel: Record<ActivityCategory, string> = {
  system: "System",
  security: "Security",
  connection: "WhatsApp",
  recipient: "Recipients",
  messaging: "Messages",
};

const levelLabel: Record<ActivityLevel, string> = {
  info: "Information",
  success: "Success",
  warning: "Warning",
  error: "Error",
};

const sourceLabel: Record<AuditSource, string> = {
  wago: "Wago",
  baileys: "WhatsApp transport",
};

const levelDot: Record<ActivityLevel, string> = {
  info: "bg-[#86918b]",
  success: "bg-[#2f8b67]",
  warning: "bg-[#c08a2e]",
  error: "bg-[#bd4a52]",
};

const levelText: Record<ActivityLevel, string> = {
  info: "text-[#66736d]",
  success: "text-[#277a59]",
  warning: "text-[#8a641f]",
  error: "text-wago-danger",
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (value) => value.toUpperCase());
}

export function ActivityEventList({ events }: { events: ActivityEvent[] }) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-wago-line bg-white">
      <div className="hidden grid-cols-[120px_120px_minmax(0,1fr)_90px] gap-4 border-b border-wago-line bg-[#f7f9f8] px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#7b8781] sm:grid">
        <span>Time</span>
        <span>Source</span>
        <span>Event</span>
        <span>Level</span>
      </div>
      <div className="divide-y divide-wago-line">
        {events.map((event) => {
          const metadata = Object.entries(event.metadata ?? {}).filter(
            ([, value]) => value !== undefined && value !== null,
          );

          return (
            <article
              key={event.id}
              className="grid min-w-0 gap-2 px-4 py-3 sm:grid-cols-[120px_120px_minmax(0,1fr)_90px] sm:gap-4"
            >
              <time className="text-[10px] leading-5 text-[#7b8781]" dateTime={event.timestamp}>
                {formatTime(event.timestamp)}
              </time>

              <div className="text-[11px] font-medium leading-5 text-[#52615a]">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#a3ada8] align-middle sm:hidden" />
                {sourceLabel[event.source]}
              </div>

              <div className="min-w-0">
                <strong className="block text-xs font-semibold text-wago-ink">{event.title}</strong>
                <p className="mb-0 mt-0.5 text-[11px] leading-5 text-wago-muted">{event.description}</p>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[9px] text-[#78847e]">
                  <span>{categoryLabel[event.category]}</span>
                  <span aria-hidden="true">·</span>
                  <code className="min-w-0 break-all font-mono text-[#66736d]">{event.code}</code>
                </div>

                {metadata.length > 0 ? (
                  <details className="mt-2 min-w-0 text-[10px] text-[#718079]">
                    <summary className="w-fit cursor-pointer select-none font-medium hover:text-wago-brand">
                      Technical details
                    </summary>
                    <dl className="mb-0 mt-2 grid min-w-0 gap-x-4 gap-y-2 border-l-2 border-wago-line bg-[#f7f9f8] px-3 py-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {metadata.map(([key, value]) => (
                        <div key={key} className="min-w-0">
                          <dt className="text-[9px] uppercase tracking-[0.05em] text-[#8a948f]">{humanizeKey(key)}</dt>
                          <dd className="mb-0 mt-0.5 break-all font-mono text-[10px] text-[#56645d]">
                            {String(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                ) : null}
              </div>

              <div className={`flex items-start gap-2 text-[11px] font-medium leading-5 ${levelText[event.level]}`}>
                <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${levelDot[event.level]}`} />
                {levelLabel[event.level]}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
