import type { ActivityCategory, ActivityEvent, ActivityLevel, AuditSource } from "../../api.js";

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
  baileys: "Baileys",
};

const levelDot: Record<ActivityLevel, string> = {
  info: "bg-[#86918b]",
  success: "bg-[#2f8b67]",
  warning: "bg-[#c08a2e]",
  error: "bg-[#bd4a52]",
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
    <div className="mt-4 overflow-hidden rounded-xl border border-wago-line bg-white">
      <div className="divide-y divide-[#e8ece9]">
        {events.map((event) => {
          const metadata = Object.entries(event.metadata ?? {}).filter(
            ([, value]) => value !== undefined && value !== null,
          );

          return (
            <article key={event.id} className="grid gap-3 px-4 py-3.5 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-4">
              <div className="flex items-start gap-2 sm:block">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full sm:hidden ${levelDot[event.level]}`} />
                <time className="text-[10px] leading-5 text-[#818b86]" dateTime={event.timestamp}>
                  {formatTime(event.timestamp)}
                </time>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className={`mt-1.5 hidden h-2 w-2 shrink-0 rounded-full sm:block ${levelDot[event.level]}`} />
                    <div className="min-w-0">
                      <strong className="block text-xs font-semibold text-wago-ink">{event.title}</strong>
                      <p className="mb-0 mt-0.5 text-[11px] leading-5 text-wago-muted">{event.description}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    <span className="rounded-full border border-[#dce7e2] bg-[#f7faf8] px-2 py-1 text-[9px] font-semibold text-[#52635b]">
                      {sourceLabel[event.source]}
                    </span>
                    <span className="rounded-full border border-[#e0e5e2] bg-[#f7f8f7] px-2 py-1 text-[9px] font-semibold text-[#626d68]">
                      {categoryLabel[event.category]}
                    </span>
                    <span className="rounded-full border border-[#e0e5e2] bg-white px-2 py-1 text-[9px] font-semibold text-[#626d68]">
                      {levelLabel[event.level]}
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="rounded bg-[#f3f5f3] px-1.5 py-1 text-[9px] text-[#66736d]">{event.code}</code>
                </div>

                {metadata.length > 0 ? (
                  <details className="mt-2 text-[10px] text-[#718079]">
                    <summary className="w-fit cursor-pointer select-none font-medium hover:text-wago-brand">
                      Technical details
                    </summary>
                    <dl className="mb-0 mt-2 grid gap-x-4 gap-y-2 rounded-lg bg-[#f6f7f5] px-3 py-2.5 sm:grid-cols-2 lg:grid-cols-3">
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
            </article>
          );
        })}
      </div>
    </div>
  );
}
