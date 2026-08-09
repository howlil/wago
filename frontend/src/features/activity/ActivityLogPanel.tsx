import { ChevronDown, Loader2, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listActivity, type ActivityCategory, type ActivityEvent, type ActivityLevel } from "../../api.js";
import { cardBodyClass, secondaryButtonClass, sectionDescriptionClass, sectionTitleClass } from "../../shared/ui/classes.js";

type ActivityLogPanelProps = {
  enabled: boolean;
};

type CategoryFilter = "all" | ActivityCategory;
type LevelFilter = "all" | "attention" | ActivityLevel;

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

export function ActivityLogPanel({ enabled }: ActivityLogPanelProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (showLoading = false) => {
    if (!enabled) {
      setEvents([]);
      return;
    }

    if (showLoading) {
      setLoading(true);
    }

    try {
      const result = await listActivity(150);
      setEvents(result.events);
      setError(null);
    } catch (caught) {
      const apiError = caught as { message?: string };
      setError(apiError.message ?? "Could not load gateway activity.");
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    void load(true);

    if (!enabled) {
      return;
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load(false);
      }
    }, 10000);

    return () => window.clearInterval(timer);
  }, [enabled, load]);

  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        if (category !== "all" && event.category !== category) {
          return false;
        }
        if (level === "attention" && event.level !== "warning" && event.level !== "error") {
          return false;
        }
        if (level !== "all" && level !== "attention" && event.level !== level) {
          return false;
        }
        return true;
      }),
    [category, events, level],
  );

  return (
    <section className={cardBodyClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={sectionTitleClass}>Activity Log</h2>
          <p className={sectionDescriptionClass}>
            Operator-readable history of connection, recipient and messaging events. Sensitive values are masked.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Filter activity category</span>
            <select
              className="h-9 appearance-none rounded-md border border-[#cfd7d2] bg-white py-1.5 pl-3 pr-8 text-xs text-[#415048] outline-none focus:border-wago-brand"
              value={category}
              onChange={(event) => setCategory(event.target.value as CategoryFilter)}
            >
              <option value="all">All categories</option>
              <option value="connection">WhatsApp</option>
              <option value="messaging">Messages</option>
              <option value="recipient">Recipients</option>
              <option value="security">Security</option>
              <option value="system">System</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 text-[#7f8a84]" size={14} />
          </label>
          <label className="relative">
            <span className="sr-only">Filter activity level</span>
            <select
              className="h-9 appearance-none rounded-md border border-[#cfd7d2] bg-white py-1.5 pl-3 pr-8 text-xs text-[#415048] outline-none focus:border-wago-brand"
              value={level}
              onChange={(event) => setLevel(event.target.value as LevelFilter)}
            >
              <option value="all">All levels</option>
              <option value="attention">Needs attention</option>
              <option value="success">Success</option>
              <option value="info">Information</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 text-[#7f8a84]" size={14} />
          </label>
          <button className={secondaryButtonClass} type="button" onClick={() => void load(true)} disabled={!enabled || loading}>
            {loading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCcw size={14} />}
            Refresh
          </button>
        </div>
      </div>

      {!enabled ? (
        <p className="mb-0 mt-4 rounded-md border border-dashed border-wago-line px-3 py-4 text-sm text-wago-muted">
          Authenticate the gateway to view operational activity.
        </p>
      ) : error ? (
        <p className="mb-0 mt-4 rounded-md border border-[#ecc9cd] bg-wago-danger-soft px-3 py-3 text-sm text-wago-danger">
          {error}
        </p>
      ) : filteredEvents.length === 0 ? (
        <p className="mb-0 mt-4 rounded-md border border-dashed border-wago-line px-3 py-4 text-sm text-wago-muted">
          {events.length === 0 ? "No activity has been recorded yet." : "No events match the selected filters."}
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-md border border-wago-line">
          <div className="max-h-[520px] divide-y divide-[#e8ece9] overflow-y-auto bg-white">
            {filteredEvents.map((event) => {
              const metadata = Object.entries(event.metadata ?? {}).filter(([, value]) => value !== undefined && value !== null);

              return (
                <article key={event.id} className="grid gap-2 px-3 py-3 sm:grid-cols-[112px_10px_minmax(0,1fr)_90px] sm:items-start sm:gap-3">
                  <time className="text-[11px] leading-5 text-[#818b86]" dateTime={event.timestamp}>
                    {formatTime(event.timestamp)}
                  </time>
                  <span className={`mt-1.5 hidden h-2 w-2 rounded-full sm:block ${levelDot[event.level]}`} />
                  <div className="min-w-0">
                    <div className="flex items-start gap-2 sm:block">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full sm:hidden ${levelDot[event.level]}`} />
                      <div>
                        <strong className="block text-[13px] font-semibold text-wago-ink">{event.title}</strong>
                        <p className="mb-0 mt-0.5 text-xs leading-5 text-wago-muted">{event.description}</p>
                      </div>
                    </div>
                    {metadata.length > 0 ? (
                      <details className="mt-1.5 text-[11px] text-[#718079]">
                        <summary className="w-fit cursor-pointer select-none font-medium hover:text-wago-brand">Technical details</summary>
                        <dl className="mb-0 mt-2 grid gap-x-4 gap-y-1 rounded-md bg-[#f6f7f5] px-3 py-2 sm:grid-cols-2">
                          {metadata.map(([key, value]) => (
                            <div key={key} className="min-w-0">
                              <dt className="text-[10px] uppercase tracking-[0.05em] text-[#8a948f]">{humanizeKey(key)}</dt>
                              <dd className="mb-0 mt-0.5 break-all font-mono text-[11px] text-[#56645d]">{String(value)}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    ) : null}
                  </div>
                  <span className="w-fit rounded bg-[#f0f2f0] px-1.5 py-1 text-[10px] font-medium text-[#66736d] sm:justify-self-end">
                    {categoryLabel[event.category]}
                  </span>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
