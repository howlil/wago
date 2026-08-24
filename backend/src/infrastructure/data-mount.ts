import { readFileSync } from "node:fs";
import { posix } from "node:path";
import { dataDirectory as configuredDataDirectory } from "../config/runtime-paths.js";

export type DataMountInspection = {
  persistent: boolean;
  mountPoint: string;
  fsType: string | null;
};

export class PersistentDataRequiredError extends Error {
  readonly code = "PERSISTENT_DATA_REQUIRED";

  constructor(message: string) {
    super(message);
    this.name = "PersistentDataRequiredError";
  }
}

const ephemeralFileSystems = new Set(["overlay", "tmpfs", "ramfs"]);
let runtimeDataMountInspection: DataMountInspection | null = null;

function decodeMountInfoPath(value: string): string {
  return value.replace(/\\([0-7]{3})/g, (_match, octal: string) => String.fromCharCode(Number.parseInt(octal, 8)));
}

function normalizeMountInfoPath(value: string): string {
  return posix.resolve("/", value);
}

function containsPath(mountPoint: string, target: string): boolean {
  if (mountPoint === "/") return target.startsWith("/");
  return target === mountPoint || target.startsWith(`${mountPoint}/`);
}

export function inspectDataMount(mountInfo: string, dataDirectory: string): DataMountInspection {
  const target = normalizeMountInfoPath(dataDirectory);
  let selected: { mountPoint: string; fsType: string } | undefined;

  for (const line of mountInfo.split("\n")) {
    if (!line.trim()) continue;

    const separatorIndex = line.indexOf(" - ");
    if (separatorIndex === -1) continue;

    const left = line.slice(0, separatorIndex).trim().split(/\s+/);
    const right = line
      .slice(separatorIndex + 3)
      .trim()
      .split(/\s+/);
    if (left.length < 5 || right.length < 1) continue;

    const mountPoint = normalizeMountInfoPath(decodeMountInfoPath(left[4] ?? "/"));
    const fsType = right[0] ?? "";
    if (!containsPath(mountPoint, target)) continue;

    if (!selected || mountPoint.length > selected.mountPoint.length) {
      selected = { mountPoint, fsType };
    }
  }

  if (!selected) {
    return { persistent: false, mountPoint: "", fsType: null };
  }

  return {
    persistent: selected.mountPoint !== "/" && !ephemeralFileSystems.has(selected.fsType),
    mountPoint: selected.mountPoint,
    fsType: selected.fsType || null,
  };
}

export function getRuntimeDataMountInspection(): DataMountInspection | null {
  return runtimeDataMountInspection ? { ...runtimeDataMountInspection } : null;
}

export function resetRuntimeDataMountInspectionForTest(): void {
  runtimeDataMountInspection = null;
}

export function assertPersistentDataMount(
  options: { nodeEnv?: string; dataDirectory?: string; mountInfoPath?: string } = {},
): DataMountInspection {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  const dataDirectory = options.dataDirectory ?? configuredDataDirectory;

  if (nodeEnv !== "production") {
    return { persistent: false, mountPoint: "", fsType: null };
  }

  runtimeDataMountInspection = null;

  let mountInfo: string;
  try {
    mountInfo = readFileSync(options.mountInfoPath ?? "/proc/self/mountinfo", "utf8");
  } catch {
    throw new PersistentDataRequiredError(
      `PERSISTENT_DATA_REQUIRED: unable to verify durable storage for ${dataDirectory}; mount persistent storage at /app/data`,
    );
  }

  const inspection = inspectDataMount(mountInfo, dataDirectory);
  if (!inspection.persistent) {
    throw new PersistentDataRequiredError(
      `PERSISTENT_DATA_REQUIRED: ${dataDirectory} is not backed by a dedicated persistent mount; mount durable storage at /app/data`,
    );
  }

  runtimeDataMountInspection = inspection;
  return inspection;
}
