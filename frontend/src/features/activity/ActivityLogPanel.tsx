import { ChevronDown, Loader2, RefreshCcw, Search } from "lucide-react";
import {
  cardBodyClass,
  secondaryButtonClass,
  sectionDescriptionClass,
  sectionTitleClass,
} from "../../shared/ui/classes.js";
import { ActivityEventList } from "./ActivityEventList.js";
import { type CategoryFilter, type LevelFilter, type SourceFilter, useActivityLog } from "./useActivityLog.js";

type ActivityLogPanelProps = {
  enabled: boolean;
  heading?: string;
};

const selectClass =
  "h-9 w-full appearance-none rounded-md border border-[#d6dfda] bg-white py-2 pl-3 pr-8 text-xs font-medium text-[#415048] outline-none transition-colors focus:border-wago-brand focus:ring-2 focus:ring-[#dcefe6]";

export function ActivityLogPanel({ enabled, heading = "Activity Log" }: ActivityLogPanelProps) {
  const {
    events,
    source,
    category,
    level,
    search,
    nextCursor,
    loading,
    loadingMore,
    error,
    setSource,
    setCategory,
    setLevel,
    setSearch,
    refresh,
    loadMore,
  } = useActivityLog(enabled);

  return (
    <section className={cardBodyClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={sectionTitleClass}>{heading}</h2>
          <p className={sectionDescriptionClass}>
            Sanitized gateway and Baileys lifecycle evidence. Message content and session secrets are not shown here.
          </p>
        </div>
        <button
          className={`${secondaryButtonClass} shrink-0`}
          type="button"
          onClick={() => void refresh()}
          disabled={!enabled || loading}
          aria-label="Refresh audit events"
        >
          {loading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCcw size={14} />}
          Refresh
        </button>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3 xl:grid-cols-[minmax(260px,1fr)_repeat(3,minmax(130px,160px))]">
        <label className="relative md:col-span-3 xl:col-span-1">
          <span className="sr-only">Search audit events</span>
          <Search className="pointer-events-none absolute left-3 top-2.5 text-[#7f8a84]" size={14} />
          <input
            className="h-9 w-full rounded-md border border-[#d6dfda] bg-white py-2 pl-9 pr-3 text-xs text-[#415048] outline-none transition-colors placeholder:text-[#9aa49f] focus:border-wago-brand focus:ring-2 focus:ring-[#dcefe6]"
            value={search}
            maxLength={100}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search code or description"
          />
        </label>

        <label className="relative">
          <span className="sr-only">Filter audit source</span>
          <select
            className={selectClass}
            value={source}
            onChange={(event) => setSource(event.target.value as SourceFilter)}
          >
            <option value="all">All sources</option>
            <option value="wago">Wago</option>
            <option value="baileys">Baileys</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 text-[#7f8a84]" size={14} />
        </label>

        <label className="relative">
          <span className="sr-only">Filter audit category</span>
          <select
            className={selectClass}
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
          <span className="sr-only">Filter audit level</span>
          <select
            className={selectClass}
            value={level}
            onChange={(event) => setLevel(event.target.value as LevelFilter)}
          >
            <option value="all">All levels</option>
            <option value="success">Success</option>
            <option value="info">Information</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 text-[#7f8a84]" size={14} />
        </label>
      </div>

      {!enabled ? (
        <p className="mb-0 mt-4 border-t border-wago-line pt-4 text-sm text-wago-muted">
          Authenticate the gateway to view operational activity.
        </p>
      ) : error ? (
        <div className="mt-4 rounded-md border border-[#ead6a2] bg-[#fff9e9] px-3 py-3">
          <strong className="block text-xs font-semibold text-[#705617]">Audit log unavailable</strong>
          <p className="mb-0 mt-1 text-xs leading-5 text-[#7d6a36]">{error}</p>
        </div>
      ) : loading && events.length === 0 ? (
        <div className="mt-4 flex items-center justify-center gap-2 border-t border-wago-line px-3 py-7 text-sm text-wago-muted">
          <Loader2 className="animate-spin" size={16} />
          Loading audit events
        </div>
      ) : events.length === 0 ? (
        <p className="mb-0 mt-4 border-t border-wago-line px-3 pt-5 text-sm text-wago-muted">
          No audit events match the current filters.
        </p>
      ) : (
        <ActivityEventList events={events} />
      )}

      {nextCursor && !error ? (
        <div className="mt-4 flex justify-center">
          <button
            className={secondaryButtonClass}
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            aria-label="Load more audit events"
          >
            {loadingMore ? <Loader2 className="animate-spin" size={14} /> : null}
            Load more
          </button>
        </div>
      ) : null}
    </section>
  );
}
