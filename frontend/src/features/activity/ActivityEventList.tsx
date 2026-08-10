import type { ActivityCategory, ActivityEvent, ActivityLevel } from "../../api.js";

const categoryLabel: Record<ActivityCategory, string> = {
  system: "System",
  security: "Security",
  connection: "WhatsApp",
  recipient: "Recipients",
  messaging: "Messages",
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
    <div className="mt-3 max-h-[390px] overflow-y-auto rounded-md border border-wago-line bg-white">
      <div className="divide-y divide-[#e8ece9]">
        {events.map((event) => {
          const metadata = Object.entries(event.metadata ?? {}).filter(
            ([, value]) => value !== undefined && value !== null,
          );

          return (
            <article
              key={event.id}
              className="grid gap-2 px-3 py-2.5 sm:grid-cols-[90px_8px_minmax(0,1fr)_76px] sm:gap-2.5"
            >
              <time className="text-[10px] leading-5 text-[#818b86]" dateTime={event.timestamp}>
                {formatTime(event.timestamp)}
              </time>
              <span className={`mt-1.5 hidden h-2 w-2 rounded-full sm:block ${levelDot[event.level]}`} />
              <div className="min-w-0">
                <div className="flex items-start gap-2 sm:block">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full sm:hidden ${levelDot[event.level]}`} />
                  <div>
                    <strong className="block text-xs font-semibold text-wago-ink">{event.title}</strong>
                    <p className="mb-0 mt-0.5 text-[11px] leading-4 text-wago-muted">{event.description}</p>
                  </div>
                </div>
                {metadata.length > 0 ? (
                  <details className="mt-1 text-[10px] text-[#718079]">
                    <summary className="w-fit cursor-pointer select-none font-medium hover:text-wago-brand">
                      Technical details
                    </summary>
                    <dl className="mb-0 mt-1.5 grid gap-x-3 gap-y-1 rounded-md bg-[#f6f7f5] px-2.5 py-2 sm:grid-cols-2">
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
              <span className="w-fit rounded bg-[#f0f2f0] px-1.5 py-1 text-[9px] font-medium text-[#66736d] sm:justify-self-end">
                {categoryLabel[event.category]}
              </span>
            </article>
          );
        })}
      </div>
    </div>
  );
}
