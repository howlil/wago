import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const featuresDirectory = join(sourceDirectory, "features");
const rootApi = join(sourceDirectory, "api.ts");

function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!entry.isFile() || (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx"))) return [];
    return [path];
  });
}

function moduleSpecifiers(source: string): string[] {
  const staticImports = Array.from(source.matchAll(/\bfrom\s+["']([^"']+)["']/g), (match) => match[1] ?? "");
  const dynamicImports = Array.from(source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g), (match) => match[1] ?? "");
  const mockedImports = Array.from(source.matchAll(/\bvi\.mock\(\s*["']([^"']+)["']/g), (match) => match[1] ?? "");
  return [...staticImports, ...dynamicImports, ...mockedImports];
}

function resolvesToRootApi(file: string, specifier: string): boolean {
  if (!specifier.startsWith(".")) return false;
  return resolve(dirname(file), specifier).replace(/\.js$/, "").replace(/\.ts$/, "") === rootApi.replace(/\.ts$/, "");
}

describe("frontend API architecture boundary", () => {
  it("keeps endpoint contracts inside feature APIs instead of the root API module", () => {
    const violations: string[] = [];

    for (const file of sourceFiles(featuresDirectory)) {
      for (const specifier of moduleSpecifiers(readFileSync(file, "utf8"))) {
        if (resolvesToRootApi(file, specifier)) {
          violations.push(`${relative(sourceDirectory, file).replaceAll("\\", "/")} -> ${specifier}`);
        }
      }
    }

    if (existsSync(rootApi)) violations.push("api.ts root god API still exists");

    expect(violations).toEqual([]);
  });
});
