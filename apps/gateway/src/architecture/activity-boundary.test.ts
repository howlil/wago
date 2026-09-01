import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const legacyActivityDirectory = join(sourceDirectory, "activity");
const legacyActivityRoute = join(sourceDirectory, "routes", "activity.routes.ts");
const legacyActivityRouteTest = join(sourceDirectory, "routes", "activity.routes.test.ts");

function sourceTypeScriptFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceTypeScriptFiles(path);
    if (!entry.isFile() || !entry.name.endsWith(".ts") || path.includes(`${join("src", "architecture")}`)) return [];
    return [path];
  });
}

function moduleSpecifiers(source: string): string[] {
  const staticImports = Array.from(source.matchAll(/\bfrom\s+["']([^"']+)["']/g), (match) => match[1] ?? "");
  const dynamicImports = Array.from(source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g), (match) => match[1] ?? "");
  const mockedImports = Array.from(source.matchAll(/\bvi\.mock\(\s*["']([^"']+)["']/g), (match) => match[1] ?? "");
  return [...staticImports, ...dynamicImports, ...mockedImports];
}

function resolvesToLegacyActivity(file: string, specifier: string): boolean {
  if (!specifier.startsWith(".")) return false;

  const target = relative(sourceDirectory, resolve(dirname(file), specifier))
    .replaceAll("\\", "/")
    .replace(/\.js$/, "");

  return (
    target === "routes/activity.routes" || target === "routes/activity.routes.test" || target.startsWith("activity/")
  );
}

describe("Activity architecture boundary", () => {
  it("keeps activity store, query, Baileys audit, and routes under src/modules/activity", () => {
    const violations: string[] = [];

    for (const file of sourceTypeScriptFiles(sourceDirectory)) {
      const relativeFile = relative(sourceDirectory, file).replaceAll("\\", "/");

      if (file.startsWith(`${legacyActivityDirectory}/`)) {
        violations.push(`${relativeFile} legacy activity file still exists`);
      }
      if (file === legacyActivityRoute || file === legacyActivityRouteTest) {
        violations.push(`${relativeFile} legacy activity route file still exists`);
      }

      for (const specifier of moduleSpecifiers(readFileSync(file, "utf8"))) {
        if (resolvesToLegacyActivity(file, specifier)) violations.push(`${relativeFile} -> ${specifier}`);
      }
    }

    expect(violations).toEqual([]);
  });
});
