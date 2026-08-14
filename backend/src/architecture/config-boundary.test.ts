import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const configDirectory = join(sourceDirectory, "config");
const forbiddenImportFragments = ["../infrastructure", "../modules", "../webhooks", "node:sqlite"] as const;

function productionTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return productionTypeScriptFiles(path);
    }

    if (!entry.isFile() || !entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) {
      return [];
    }

    return [path];
  });
}

function staticImports(source: string): string[] {
  return Array.from(source.matchAll(/\bfrom\s+["']([^"']+)["']/g), (match) => match[1] ?? "");
}

describe("config architecture boundary", () => {
  it("keeps config free from feature and persistence dependencies", () => {
    const violations = productionTypeScriptFiles(configDirectory).flatMap((file) => {
      const imports = staticImports(readFileSync(file, "utf8"));
      return imports
        .filter((specifier) => forbiddenImportFragments.some((fragment) => specifier.includes(fragment)))
        .map((specifier) => `${relative(sourceDirectory, file)} -> ${specifier}`);
    });

    expect(violations).toEqual([]);
  });
});
