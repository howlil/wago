import { existsSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { config } from "../config/index.js";
import {
  JsonFileCorruptionError,
  readJsonFile,
  readJsonFileSync,
  writeJsonFileAtomic,
  writeJsonFileAtomicSync,
} from "./json-file.js";

const asyncFile = resolve(config.dataDirectory, `json-file-async-${process.pid}.json`);
const syncFile = resolve(config.dataDirectory, `json-file-sync-${process.pid}.json`);
const corruptFile = resolve(config.dataDirectory, `json-file-corrupt-${process.pid}.json`);

function isValue(value: unknown): value is { value: string } {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "value" in value &&
    typeof (value as { value?: unknown }).value === "string"
  );
}

afterEach(() => {
  for (const file of [asyncFile, syncFile, corruptFile]) {
    rmSync(file, { force: true });
    rmSync(`${file}.corrupt`, { force: true });
  }
});

describe("atomic JSON file primitives", () => {
  it("round-trips async and sync JSON writes", async () => {
    await writeJsonFileAtomic(asyncFile, { value: "async" });
    writeJsonFileAtomicSync(syncFile, { value: "sync" });

    await expect(readJsonFile(asyncFile, isValue)).resolves.toEqual({ value: "async" });
    expect(readJsonFileSync(syncFile, isValue)).toEqual({ value: "sync" });
  });

  it("keeps a recovery copy when persistent JSON is corrupt", () => {
    writeFileSync(corruptFile, "{broken-json", { mode: 0o600 });

    expect(() => readJsonFileSync(corruptFile, isValue)).toThrow(JsonFileCorruptionError);
    expect(existsSync(`${corruptFile}.corrupt`)).toBe(true);
  });
});
