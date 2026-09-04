import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { ActivityCategory, ActivityEvent, ActivityLevel, AuditSource } from "./api.js";

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
  baileys: "WhatsApp transport",
};

const levelDot: Record<ActivityLevel, string> = {
  info: "bg-wago-tertiary",
  success: "bg-wago-positive",
  warning: "bg-wago-warning",
  error: "bg-wago-danger",
};

const levelText: Record<ActivityLevel, string> = {
  info: "text-wago-secondary",
  success: "text-wago-positive",
  warning: "text-wago-warning",
  error: "text-wago-danger",
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
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

function detailsId(eventId: string): string {
  return `event-details-${eventId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export function ActivityEventList({ events }: { events: ActivityEvent[] }) {
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  return (
    <div className="mt-2.5 border-y border-wago-workspace-line">
      <div className="hidden grid-cols-[110px_120px_minmax(0,1fr)_92px] gap-3 border-b border-wago-workspace-line bg-wago-workspace-strong px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-wago-tertiary sm:grid">
        <span>Time</span>
        <span>Source</span>
        <span>Event</span>
        <span>Level</span>
      </div>
      <div className="divide-y divide-wago-workspace-line">
        {events.map((event) => {
          const metadata = Object.entries(event.metadata ?? {}).filter(
            ([, value]) => value !== undefined && value !== null,
          );
          const expandable = metadata.length > 0;
          const expanded = expandedEventId === event.id;
          const disclosureId = detailsId(event.id);

          return (
            <motion.article
              layout="position"
              key={event.id}
              className={`grid min-w-0 gap-1.5 bg-wago-console-row px-2.5 py-2 sm:grid-cols-[110px_120px_minmax(0,1fr)_92px] sm:gap-3 ${
                expandable ? "hover:bg-wago-console-row-hover" : ""
              }`}
              transition={{ duration: 0.12 }}
            >
              <time className="text-[10px] leading-4 text-wago-tertiary" dateTime={event.timestamp}>
                {formatTime(event.timestamp)}
              </time>

              <div className="text-[11px] font-medium leading-4 text-wago-secondary">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-wago-tertiary align-middle sm:hidden" />
                {sourceLabel[event.source]}
              </div>

              <div className="min-w-0">
                <strong className="block text-xs font-semibold leading-4 text-wago-ink">{event.title}</strong>
                <p className="mb-0 mt-0.5 text-[11px] leading-4 text-wago-muted sm:line-clamp-1">{event.description}</p>
                <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] leading-4 text-wago-tertiary">
                  <span>{categoryLabel[event.category]}</span>
                  <span aria-hidden="true">·</span>
                  <code className="min-w-0 break-all font-mono text-wago-secondary">{event.code}</code>
                </div>

                {expandable ? (
                  <>
                    <button
                      className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium text-wago-secondary hover:text-wago-brand-strong"
                      type="button"
                      onClick={() => setExpandedEventId((current) => (current === event.id ? null : event.id))}
                      aria-expanded={expanded}
                      aria-controls={disclosureId}
                    >
                      <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.12 }}>
                        <ChevronDown size={12} aria-hidden="true" />
                      </motion.span>
                      Technical details
                    </button>
                    <AnimatePresence initial={false}>
                      {expanded ? (
                        <motion.div
                          id={disclosureId}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.14 }}
                          className="overflow-hidden"
                        >
                          <dl className="mb-0 mt-1.5 grid min-w-0 gap-x-3 gap-y-1.5 border-l-2 border-wago-workspace-line bg-wago-workspace-strong px-2.5 py-2 sm:grid-cols-2 lg:grid-cols-3">
                            {metadata.map(([key, value]) => (
                              <div key={key} className="min-w-0">
                                <dt className="text-[10px] uppercase tracking-[0.05em] text-wago-tertiary">
                                  {humanizeKey(key)}
                                </dt>
                                <dd className="mb-0 mt-0.5 break-all font-mono text-[10px] text-wago-secondary">
                                  {String(value)}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </>
                ) : null}
              </div>

              <div className={`flex items-start gap-1.5 text-[11px] font-medium leading-4 ${levelText[event.level]}`}>
                <span className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${levelDot[event.level]}`} />
                {levelLabel[event.level]}
              </div>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}
