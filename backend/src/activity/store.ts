import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { config } from "../config/index.js";
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
const activityFile =
  process.env.NODE_ENV === "test"
    ? resolve(config.dataDirectory, `activity-log-${process.pid}.json`)
    : resolve(config.dataDirectory, "activity-log.json");

let writeQueue: Promise<void> = Promise.resolve();

async function readActivityFile(): Promise<ActivityEvent[]> {
  try {
    const raw = await readFile(activityFile, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    return Array.isArray(parsed) ? (parsed as ActivityEvent[]) : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    logger.warn({ event: "activity.read_failed", error }, "Failed to read operator activity log");
    return [];
  }
}

async function writeActivityFile(events: ActivityEvent[]): Promise<void> {
  await mkdir(dirname(activityFile), { recursive: true });
  const tmpFile = `${activityFile}.${process.pid}.tmp`;
  await writeFile(tmpFile, `${JSON.stringify(events, null, 2)}\n`, { mode: 0o600 });
  await rename(tmpFile, activityFile);
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

export async function listActivity(limit = 100): Promise<ActivityEvent[]> {
  await writeQueue.catch(() => undefined);
  const events = await readActivityFile();
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 100, 1), MAX_ACTIVITY_EVENTS);

  return events.slice(0, safeLimit);
}

export async function resetActivityLogForTest(): Promise<void> {
  writeQueue = Promise.resolve();
  await writeActivityFile([]);
}
