import { ChevronDown, Loader2, RefreshCcw } from "lucide-react";
import {
  cardBodyClass,
  secondaryButtonClass,
  sectionDescriptionClass,
  sectionTitleClass,
} from "../../shared/ui/classes.js";
import { ActivityEventList } from "./ActivityEventList.js";
import { type CategoryFilter, type LevelFilter, useActivityLog } from "./useActivityLog.js";

type ActivityLogPanelProps = {
  enabled: boolean;
};

export function ActivityLogPanel({ enabled }: ActivityLogPanelProps) {
  const { events, filteredEvents, category, level, loading, error, setCategory, setLevel, load } =
    useActivityLog(enabled);

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
        <ActivityEventList events={filteredEvents} />
      )}
    </section>
  );
}
