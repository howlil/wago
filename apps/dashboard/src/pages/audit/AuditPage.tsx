import { ActivityLogPanel } from "../../features/activity/ActivityLogPanel.js";
import type {
  ActivityLogInitialFilters,
  CategoryFilter,
  LevelFilter,
  SourceFilter,
} from "../../features/activity/useActivityLog.js";
import { AppShell } from "../../shared/components/AppShell.js";
import { pageFrameClass } from "../../shared/ui/classes.js";

const sourceFilters = new Set<SourceFilter>(["all", "wago", "baileys"]);
const categoryFilters = new Set<CategoryFilter>(["all", "system", "security", "connection", "recipient", "messaging"]);
const levelFilters = new Set<LevelFilter>(["all", "info", "success", "warning", "error"]);

function initialAuditFilters(): ActivityLogInitialFilters {
  if (typeof window === "undefined") return {};

  const params = new URLSearchParams(window.location.search);
  const source = params.get("source") as SourceFilter | null;
  const category = params.get("category") as CategoryFilter | null;
  const level = params.get("level") as LevelFilter | null;
  const search = params.get("q")?.trim().slice(0, 100);

  return {
    ...(source && sourceFilters.has(source) ? { source } : {}),
    ...(category && categoryFilters.has(category) ? { category } : {}),
    ...(level && levelFilters.has(level) ? { level } : {}),
    ...(search ? { search } : {}),
  };
}

export function AuditPage() {
  return (
    <AppShell title="Audit Log" activePath="/audit">
      <div className={pageFrameClass}>
        <ActivityLogPanel enabled initialFilters={initialAuditFilters()} />
      </div>
    </AppShell>
  );
}
