import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const legacyAccessRoute = join(sourceDirectory, "routes", "app.routes.ts");

function sourceTypeScriptFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return sourceTypeScriptFiles(path);
    }

    if (!entry.isFile() || !entry.name.endsWith(".ts") || path.includes(`${join("src", "architecture")}`)) {
      return [];
    }

    return [path];
  });
}

function moduleSpecifiers(source: string): string[] {
  const staticImports = Array.from(source.matchAll(/\bfrom\s+["']([^"']+)["']/g), (match) => match[1] ?? "");
  const dynamicImports = Array.from(source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g), (match) => match[1] ?? "");
  const mockedImports = Array.from(source.matchAll(/\bvi\.mock\(\s*["']([^"']+)["']/g), (match) => match[1] ?? "");

  return [...staticImports, ...dynamicImports, ...mockedImports];
}

function resolvesToLegacyAccessRoute(file: string, specifier: string): boolean {
  if (!specifier.startsWith(".")) return false;

  const target = relative(sourceDirectory, resolve(dirname(file), specifier))
    .replaceAll("\\", "/")
    .replace(/\.js$/, ".ts");

  return target === "routes/app.routes.ts";
}

describe("Access architecture boundary", () => {
  it("keeps Access route ownership under src/modules/access", () => {
    const violations: string[] = [];

    for (const file of sourceTypeScriptFiles(sourceDirectory)) {
      const relativeFile = relative(sourceDirectory, file).replaceAll("\\", "/");

      for (const specifier of moduleSpecifiers(readFileSync(file, "utf8"))) {
        if (resolvesToLegacyAccessRoute(file, specifier)) {
          violations.push(`${relativeFile} -> ${specifier}`);
        }
      }
    }

    if (existsSync(legacyAccessRoute)) {
      violations.push("routes/app.routes.ts legacy access route still exists");
    }

    expect(violations).toEqual([]);
  });
});
