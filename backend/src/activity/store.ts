import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { config } from "../config/index.js";
import { readJsonFile, writeJsonFileAtomic } from "../infrastructure/json-file.js";
import { logger, redactLogFields } from "../infrastructure/logger.js";

export type ActivityLevel = "info" | "success" | "warning" | "error";
export type ActivityCategory = "system" | "security" | "connection" | "recipient" | "messaging";

export type ActivityMetadata = Record<string, string | number | boolean | null | undefined>;

export type ActivityEvent = {
  id: string;
  timestamp: string;
  level: ActivityLevel;
  category: ActivityCategory;
  code: string;
  title: string;
  description: string;
  metadata?: ActivityMetadata;
};

export type ActivityInput = Omit<ActivityEvent, "id" | "timestamp">;

const MAX_ACTIVITY_EVENTS = 300;
const ACTIVITY_STORE_VERSION = 1 as const;
const activityFile =
  process.env.NODE_ENV === "test"
    ? resolve(config.dataDirectory, `activity-log-${process.pid}.json`)
    : resolve(config.dataDirectory, "activity-log.json");

type ActivityEnvelope = {
  version: typeof ACTIVITY_STORE_VERSION;
  data: ActivityEvent[];
};
type StoredActivityFile = ActivityEvent[] | ActivityEnvelope;

let writeQueue: Promise<void> = Promise.resolve();

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isActivityEvent(value: unknown): value is ActivityEvent {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.timestamp === "string" &&
    (value.level === "info" || value.level === "success" || value.level === "warning" || value.level === "error") &&
    (value.category === "system" ||
      value.category === "security" ||
      value.category === "connection" ||
      value.category === "recipient" ||
      value.category === "messaging") &&
    typeof value.code === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    (value.metadata === undefined || isRecord(value.metadata))
  );
}

function isActivityArray(value: unknown): value is ActivityEvent[] {
  return Array.isArray(value) && value.every(isActivityEvent);
}

function isStoredActivityFile(value: unknown): value is StoredActivityFile {
  if (isActivityArray(value)) {
    return true;
  }

  return (
    isRecord(value) &&
    value.version === ACTIVITY_STORE_VERSION &&
    "data" in value &&
    isActivityArray(value.data)
  );
}

async function readActivityFile(): Promise<ActivityEvent[]> {
  try {
    const stored = await readJsonFile(activityFile, isStoredActivityFile);

    if (!stored) {
      return [];
    }

    return Array.isArray(stored) ? stored : stored.data;
  } catch (error) {
    logger.warn({ event: "activity.read_failed", error }, "Failed to read operator activity log");
    return [];
  }
}

async function writeActivityFile(events: ActivityEvent[]): Promise<void> {
  await writeJsonFileAtomic(activityFile, {
    version: ACTIVITY_STORE_VERSION,
    data: events,
  } satisfies ActivityEnvelope);
}

export async function recordActivity(input: ActivityInput): Promise<ActivityEvent> {
  const event: ActivityEvent = {
    ...input,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    metadata: input.metadata ? redactLogFields(input.metadata) : undefined,
  };

  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      try {
        const current = await readActivityFile();
        await writeActivityFile([event, ...current].slice(0, MAX_ACTIVITY_EVENTS));
      } catch (error) {
        logger.warn({ event: "activity.write_failed", error }, "Failed to persist operator activity log");
      }
    });

  await writeQueue;
  return event;
}

export async function flushActivityStore(): Promise<void> {
  await writeQueue.catch(() => undefined);
}

export async function listActivity(limit = 100): Promise<ActivityEvent[]> {
  await flushActivityStore();
  const events = await readActivityFile();
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 100, 1), MAX_ACTIVITY_EVENTS);

  return events.slice(0, safeLimit);
}

export async function resetActivityLogForTest(): Promise<void> {
  await flushActivityStore();
  writeQueue = Promise.resolve();
  await writeActivityFile([]);
}
