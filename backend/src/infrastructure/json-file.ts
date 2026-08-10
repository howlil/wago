import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  copyFileSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { copyFile, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";

export type JsonValidator<T> = (value: unknown) => value is T;

export class JsonFileCorruptionError extends Error {
  readonly filePath: string;
  readonly backupPath: string;

  constructor(filePath: string, backupPath: string) {
    super(`Persistent JSON file is invalid: ${filePath}. A recovery copy is available at ${backupPath}.`);
    this.name = "JsonFileCorruptionError";
    this.filePath = filePath;
    this.backupPath = backupPath;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function backupPath(filePath: string): string {
  return `${filePath}.corrupt`;
}

async function preserveCorruptFile(filePath: string): Promise<string> {
  const target = backupPath(filePath);

  try {
    await copyFile(filePath, target, constants.COPYFILE_EXCL);
  } catch (error) {
    if (!isNodeError(error) || error.code !== "EEXIST") {
      throw error;
    }
  }

  return target;
}

function preserveCorruptFileSync(filePath: string): string {
  const target = backupPath(filePath);

  try {
    copyFileSync(filePath, target, constants.COPYFILE_EXCL);
  } catch (error) {
    if (!isNodeError(error) || error.code !== "EEXIST") {
      throw error;
    }
  }

  return target;
}

export async function readJsonFile<T>(filePath: string, validate: JsonValidator<T>): Promise<T | null> {
  let raw: string;

  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!validate(parsed)) {
      throw new TypeError("Persistent JSON payload does not match the expected schema");
    }

    return parsed;
  } catch {
    const recoveryPath = await preserveCorruptFile(filePath);
    throw new JsonFileCorruptionError(filePath, recoveryPath);
  }
}

export function readJsonFileSync<T>(filePath: string, validate: JsonValidator<T>): T | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;

    if (!validate(parsed)) {
      throw new TypeError("Persistent JSON payload does not match the expected schema");
    }

    return parsed;
  } catch (error) {
    if (error instanceof JsonFileCorruptionError) {
      throw error;
    }

    const recoveryPath = preserveCorruptFileSync(filePath);
    throw new JsonFileCorruptionError(filePath, recoveryPath);
  }
}

async function syncDirectory(directory: string): Promise<void> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;

  try {
    handle = await open(directory, "r");
    await handle.sync();
  } catch {
    // Directory fsync is not supported on every platform. The file itself is
    // still fsynced before rename, so this is an additional durability step.
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function syncDirectorySync(directory: string): void {
  let descriptor: number | undefined;

  try {
    descriptor = openSync(directory, "r");
    fsyncSync(descriptor);
  } catch {
    // See async counterpart above.
  } finally {
    if (descriptor !== undefined) {
      closeSync(descriptor);
    }
  }
}

export async function writeJsonFileAtomic(filePath: string, value: unknown): Promise<void> {
  const directory = dirname(filePath);
  await mkdir(directory, { recursive: true });

  const temporaryFile = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  let handle: Awaited<ReturnType<typeof open>> | undefined;

  try {
    handle = await open(temporaryFile, "w", 0o600);
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;

    await rename(temporaryFile, filePath);
    await syncDirectory(directory);
  } finally {
    await handle?.close().catch(() => undefined);
    await rm(temporaryFile, { force: true }).catch(() => undefined);
  }
}

export function writeJsonFileAtomicSync(filePath: string, value: unknown): void {
  const directory = dirname(filePath);
  mkdirSync(directory, { recursive: true });

  const temporaryFile = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  let descriptor: number | undefined;

  try {
    descriptor = openSync(temporaryFile, "w", 0o600);
    writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;

    renameSync(temporaryFile, filePath);
    syncDirectorySync(directory);
  } finally {
    if (descriptor !== undefined) {
      closeSync(descriptor);
    }
    rmSync(temporaryFile, { force: true });
  }
}
