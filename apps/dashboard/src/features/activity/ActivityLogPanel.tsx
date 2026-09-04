import { ChevronDown, ChevronLeft, ChevronRight, Loader2, RefreshCcw, Search } from "lucide-react";
import { motion } from "motion/react";
import { Fragment, useEffect, useState } from "react";
import { secondaryButtonClass } from "../../shared/ui/classes.js";
import { ActivityEventList } from "./ActivityEventList.js";
import {
  type ActivityLogInitialFilters,
  type CategoryFilter,
  type LevelFilter,
  type SourceFilter,
  useActivityLog,
} from "./useActivityLog.js";

type ActivityLogPanelProps = {
  enabled: boolean;
  initialFilters?: ActivityLogInitialFilters;
};

const selectClass =
  "h-8 w-full appearance-none rounded-md border border-wago-control-line bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-wago-secondary outline-none transition-colors focus:border-wago-brand focus:ring-2 focus:ring-wago-brand-soft";

export function ActivityLogPanel({ enabled, initialFilters }: ActivityLogPanelProps) {
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
  } = useActivityLog(enabled, initialFilters);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [source, category, level, search, rowsPerPage]);

  const pageCount = Math.max(1, Math.ceil(events.length / rowsPerPage));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * rowsPerPage;
  const end = Math.min(start + rowsPerPage, events.length);
  const visibleEvents = events.slice(start, end);
  const pageNumbers = Array.from(
    new Set([0, safePage - 1, safePage, safePage + 1, pageCount - 1].filter((value) => value >= 0 && value < pageCount)),
  ).sort((left, right) => left - right);

  return (
    <section className="min-w-0">
      <p className="mb-0 text-xs leading-4 text-wago-muted">
        Sanitized gateway and WhatsApp lifecycle evidence. Message content and session secrets are not shown.
      </p>

      <div className="mt-2.5 grid gap-2 border-y border-wago-workspace-line bg-wago-control-surface py-2 sm:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_140px_150px_130px_auto]">
        <label className="relative sm:col-span-2 xl:col-span-1">
          <span className="sr-only">Search audit events</span>
          <Search className="pointer-events-none absolute left-3 top-2 text-wago-tertiary" size={14} />
          <input
            className="h-8 w-full rounded-md border border-wago-control-line bg-white py-1.5 pl-9 pr-3 text-xs text-wago-secondary outline-none transition-colors placeholder:text-wago-tertiary focus:border-wago-brand focus:ring-2 focus:ring-wago-brand-soft"
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
            <option value="baileys">WhatsApp transport</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-2 text-wago-tertiary" size={14} />
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
          <ChevronDown className="pointer-events-none absolute right-2.5 top-2 text-wago-tertiary" size={14} />
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
          <ChevronDown className="pointer-events-none absolute right-2.5 top-2 text-wago-tertiary" size={14} />
        </label>

        <motion.button
          className={`${secondaryButtonClass} w-full shrink-0 sm:col-span-2 xl:col-span-1 xl:w-auto`}
          type="button"
          onClick={() => void refresh()}
          disabled={!enabled || loading}
          aria-label="Refresh audit events"
          whileTap={loading ? undefined : { scale: 0.985 }}
          transition={{ duration: 0.1 }}
        >
          {loading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCcw size={14} />}
          Refresh
        </motion.button>
      </div>

      {!enabled ? (
        <p className="mb-0 mt-3 text-sm text-wago-muted">Authenticate the gateway to view operational activity.</p>
      ) : error ? (
        <div className="mt-3 border-y border-wago-warning/30 bg-wago-warning-soft px-3 py-2.5">
          <strong className="block text-xs font-semibold text-wago-warning">Audit log unavailable</strong>
          <p className="mb-0 mt-0.5 text-xs leading-4 text-wago-warning">{error}</p>
        </div>
      ) : loading && events.length === 0 ? (
        <div className="mt-3 flex items-center justify-center gap-2 border-y border-wago-workspace-line px-3 py-5 text-sm text-wago-muted">
          <Loader2 className="animate-spin" size={16} />
          Loading audit events
        </div>
      ) : events.length === 0 ? (
        <p className="mb-0 mt-3 border-y border-wago-workspace-line px-3 py-4 text-sm text-wago-muted">
          No audit events match the current filters.
        </p>
      ) : (
        <>
          <ActivityEventList events={visibleEvents} />
          <div className="flex flex-col gap-2 border-b border-wago-workspace-line bg-wago-control-surface px-2 py-2 text-[11px] text-wago-muted md:flex-row md:items-center md:justify-between">
            <motion.span
              key={`${events.length}-${safePage}-${rowsPerPage}`}
              initial={{ opacity: 0.55 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.12 }}
            >
              Showing {start + 1}–{end} of {events.length} loaded{nextCursor ? " · more available" : ""}
            </motion.span>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5">
                <span>Rows</span>
                <select
                  className="h-7 rounded-md border border-wago-control-line bg-white px-2 text-[11px] font-medium text-wago-secondary"
                  value={rowsPerPage}
                  onChange={(event) => setRowsPerPage(Number(event.target.value))}
                  aria-label="Rows per page"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={25}>25</option>
                </select>
              </label>

              <div className="flex items-center gap-1" aria-label="Audit pagination">
                <button
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-wago-control-line bg-white text-wago-secondary disabled:opacity-40"
                  type="button"
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  disabled={safePage === 0}
                  aria-label="Previous audit page"
                >
                  <ChevronLeft size={13} />
                </button>

                {pageNumbers.map((pageNumber, index) => {
                  const previous = pageNumbers[index - 1];
                  return (
                    <Fragment key={pageNumber}>
                      {previous !== undefined && pageNumber - previous > 1 ? <span className="px-0.5">…</span> : null}
                      <button
                        className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 font-medium ${
                          pageNumber === safePage
                            ? "border border-wago-selected-line bg-wago-selected text-wago-brand-strong"
                            : "border border-transparent text-wago-secondary hover:bg-wago-console-row-hover"
                        }`}
                        type="button"
                        onClick={() => setPage(pageNumber)}
                        aria-current={pageNumber === safePage ? "page" : undefined}
                        aria-label={`Audit page ${pageNumber + 1}`}
                      >
                        {pageNumber + 1}
                      </button>
                    </Fragment>
                  );
                })}

                <button
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-wago-control-line bg-white text-wago-secondary disabled:opacity-40"
                  type="button"
                  onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
                  disabled={safePage >= pageCount - 1}
                  aria-label="Next audit page"
                >
                  <ChevronRight size={13} />
                </button>
              </div>

              {nextCursor ? (
                <button
                  className="h-7 rounded-md border border-wago-control-line bg-white px-2.5 text-[11px] font-medium text-wago-ink hover:bg-wago-hover disabled:text-wago-disabled"
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  aria-label="Load more audit events"
                >
                  {loadingMore ? "Loading" : "Load more"}
                </button>
              ) : null}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
