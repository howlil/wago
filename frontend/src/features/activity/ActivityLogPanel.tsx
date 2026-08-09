import { ChevronDown, Loader2, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type ActivityCategory, type ActivityEvent, type ActivityLevel, listActivity } from "../../api.js";
import {
  cardBodyClass,
  secondaryButtonClass,
  sectionDescriptionClass,
  sectionTitleClass,
} from "../../shared/ui/classes.js";

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

function activityErrorMessage(error: unknown): string {
  const apiError = error as { error?: string; message?: string };

  if (apiError.error === "NON_JSON_RESPONSE") {
    return "Activity log is unavailable on the running backend. Restart or update the backend, then refresh.";
  }

  return apiError.message ?? "Could not load gateway activity.";
}

export function ActivityLogPanel({ enabled }: ActivityLogPanelProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (showLoading = false) => {
      if (!enabled) {
        setEvents([]);
        return;
      }

      if (showLoading) {
        setLoading(true);
      }

      try {
        const result = await listActivity(150);

        if (!Array.isArray(result.events)) {
          setEvents([]);
          setError("Activity endpoint returned an invalid response. Restart or update the backend, then refresh.");
          return;
        }

        setEvents(result.events);
        setError(null);
      } catch (caught) {
        setEvents([]);
        setError(activityErrorMessage(caught));
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [enabled],
  );

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
    <section className={`${cardBodyClass} h-full`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={sectionTitleClass}>Activity Log</h2>
          <p className={sectionDescriptionClass}>Recent operational events. Sensitive values are masked.</p>
        </div>
        <button
          className={secondaryButtonClass}
          type="button"
          onClick={() => void load(true)}
          disabled={!enabled || loading}
        >
          {loading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCcw size={14} />}
          Refresh
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="relative">
          <span className="sr-only">Filter activity category</span>
          <select
            className="h-9 w-full appearance-none rounded-md border border-[#cfd7d2] bg-white py-1.5 pl-3 pr-8 text-xs text-[#415048] outline-none focus:border-wago-brand"
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
            className="h-9 w-full appearance-none rounded-md border border-[#cfd7d2] bg-white py-1.5 pl-3 pr-8 text-xs text-[#415048] outline-none focus:border-wago-brand"
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
      </div>

      {!enabled ? (
        <p className="mb-0 mt-3 rounded-md border border-dashed border-wago-line px-3 py-4 text-sm text-wago-muted">
          Authenticate the gateway to view operational activity.
        </p>
      ) : error ? (
        <div className="mt-3 rounded-md border border-[#ead6a2] bg-[#fff9e9] px-3 py-3">
          <strong className="block text-xs font-semibold text-[#705617]">Activity log unavailable</strong>
          <p className="mb-0 mt-1 text-xs leading-5 text-[#7d6a36]">{error}</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <p className="mb-0 mt-3 rounded-md border border-dashed border-wago-line px-3 py-4 text-sm text-wago-muted">
          {events.length === 0 ? "No activity has been recorded yet." : "No events match the selected filters."}
        </p>
      ) : (
        <div className="mt-3 max-h-[390px] overflow-y-auto rounded-md border border-wago-line bg-white">
          <div className="divide-y divide-[#e8ece9]">
            {filteredEvents.map((event) => {
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
                              <dt className="text-[9px] uppercase tracking-[0.05em] text-[#8a948f]">
                                {humanizeKey(key)}
                              </dt>
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
      )}
    </section>
  );
}
