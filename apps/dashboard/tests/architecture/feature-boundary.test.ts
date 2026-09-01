import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const sourceDirectory = join(process.cwd(), "src");
const featuresDirectory = join(sourceDirectory, "features");

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function source(path: string): string {
  return readFileSync(path, "utf8");
}

describe("frontend feature boundary", () => {
  it("keeps route page components out of feature folders", () => {
    const featurePages = collectSourceFiles(featuresDirectory)
      .map((path) => relative(sourceDirectory, path))
      .filter((path) => /Page\.(ts|tsx)$/.test(path));

    expect(featurePages).toEqual([]);
  });

  it("keeps messages independent from recipient management", () => {
    const messageSources = collectSourceFiles(join(featuresDirectory, "messages"))
      .map((path) => source(path))
      .join("\n");

    expect(messageSources).not.toContain("../recipients/");
  });
});
