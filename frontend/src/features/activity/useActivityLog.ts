import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type ActivityCategory,
  type ActivityEvent,
  type ActivityLevel,
  type ActivityQuery,
  type AuditSource,
  listActivity,
} from "./api.js";

export type SourceFilter = "all" | AuditSource;
export type CategoryFilter = "all" | ActivityCategory;
export type LevelFilter = "all" | ActivityLevel;

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

function activityErrorMessage(error: unknown): string {
  const apiError = error as { error?: string; message?: string };

  if (apiError.error === "NON_JSON_RESPONSE") {
    return "Activity log is unavailable on the running backend. Restart or update the backend, then refresh.";
  }

  return apiError.message ?? "Could not load gateway activity.";
}

function appendUniqueEvents(current: ActivityEvent[], incoming: ActivityEvent[]): ActivityEvent[] {
  const byId = new Map(current.map((event) => [event.id, event]));
  for (const event of incoming) {
    byId.set(event.id, event);
  }
  return Array.from(byId.values());
}

export function useActivityLog(enabled: boolean) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [source, setSource] = useState<SourceFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      setDebouncedSearch(search.trim().slice(0, 100));
    }, SEARCH_DEBOUNCE_MS);
    return () => globalThis.clearTimeout(timer);
  }, [search]);

  const query = useMemo<ActivityQuery>(
    () => ({
      limit: PAGE_SIZE,
      ...(source === "all" ? {} : { source }),
      ...(category === "all" ? {} : { category }),
      ...(level === "all" ? {} : { level }),
      ...(debouncedSearch ? { q: debouncedSearch } : {}),
    }),
    [source, category, level, debouncedSearch],
  );

  const loadPage = useCallback(
    async (request: ActivityQuery, append = false) => {
      if (!enabled) {
        setEvents([]);
        setNextCursor(undefined);
        setError(null);
        return;
      }

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const result = await listActivity(request);

        if (!Array.isArray(result.events)) {
          if (!append) {
            setEvents([]);
            setNextCursor(undefined);
          }
          setError("Activity endpoint returned an invalid response. Restart or update the backend, then refresh.");
          return;
        }

        setEvents((current) => (append ? appendUniqueEvents(current, result.events) : result.events));
        setNextCursor(result.nextCursor);
        setError(null);
      } catch (caught) {
        if (!append) {
          setEvents([]);
          setNextCursor(undefined);
        }
        setError(activityErrorMessage(caught));
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [enabled],
  );

  useEffect(() => {
    void loadPage(query);
  }, [loadPage, query]);

  function refresh(): Promise<void> {
    return loadPage(query);
  }

  function loadMore(): Promise<void> {
    if (!nextCursor || loadingMore) {
      return Promise.resolve();
    }

    return loadPage({ ...query, before: nextCursor }, true);
  }

  return {
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
  };
}
