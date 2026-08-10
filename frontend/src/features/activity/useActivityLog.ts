import { useCallback, useEffect, useMemo, useState } from "react";
import { type ActivityCategory, type ActivityEvent, type ActivityLevel, listActivity } from "../../api.js";

export type CategoryFilter = "all" | ActivityCategory;
export type LevelFilter = "all" | "attention" | ActivityLevel;

function activityErrorMessage(error: unknown): string {
  const apiError = error as { error?: string; message?: string };

  if (apiError.error === "NON_JSON_RESPONSE") {
    return "Activity log is unavailable on the running backend. Restart or update the backend, then refresh.";
  }

  return apiError.message ?? "Could not load gateway activity.";
}

export function useActivityLog(enabled: boolean) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (showLoading = false) => {
      if (!enabled) {
        setEvents([]);
        setError(null);
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

  return {
    events,
    filteredEvents,
    category,
    level,
    loading,
    error,
    setCategory,
    setLevel,
    load,
  };
}
