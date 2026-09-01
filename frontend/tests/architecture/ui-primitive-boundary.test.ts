import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const sourceDirectory = join(process.cwd(), "src");
const radixImportPattern = /(?:from\s+|import\s*\(\s*)["']@radix-ui\//;

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function normalizedSourcePath(path: string): string {
  return relative(sourceDirectory, path).replaceAll("\\", "/");
}

describe("frontend UI primitive boundary", () => {
  it("keeps Radix imports behind shared UI adapters", () => {
    const violations = collectSourceFiles(sourceDirectory)
      .filter((path) => radixImportPattern.test(readFileSync(path, "utf8")))
      .map(normalizedSourcePath)
      .filter((path) => !path.startsWith("shared/ui/"));

    expect(violations).toEqual([]);
  });
});
