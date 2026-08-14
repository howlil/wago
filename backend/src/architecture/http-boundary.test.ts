import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const legacyMiddlewareDirectory = join(sourceDirectory, "middleware");
const legacyErrorHandlerAlias = join(sourceDirectory, "http", "error-handler.ts");

function productionTypeScriptFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return productionTypeScriptFiles(path);
    }

    if (
      !entry.isFile() ||
      !entry.name.endsWith(".ts") ||
      entry.name.endsWith(".test.ts") ||
      path.includes(`${join("src", "architecture")}`)
    ) {
      return [];
    }

    return [path];
  });
}

function staticImports(source: string): string[] {
  return Array.from(source.matchAll(/\bfrom\s+["']([^"']+)["']/g), (match) => match[1] ?? "");
}

function resolvesToLegacyMiddleware(file: string, specifier: string): boolean {
  if (!specifier.startsWith(".")) return false;
  const target = relative(sourceDirectory, resolve(dirname(file), specifier)).replaceAll("\\", "/");
  return target.startsWith("middleware/");
}

describe("HTTP architecture boundary", () => {
  it("keeps all HTTP middleware under src/http/middleware without compatibility aliases", () => {
    const violations = productionTypeScriptFiles(sourceDirectory).flatMap((file) =>
      staticImports(readFileSync(file, "utf8"))
        .filter((specifier) => resolvesToLegacyMiddleware(file, specifier))
        .map((specifier) => `${relative(sourceDirectory, file)} -> ${specifier}`),
    );

    for (const file of productionTypeScriptFiles(legacyMiddlewareDirectory)) {
      violations.push(`${relative(sourceDirectory, file)} legacy middleware file still exists`);
    }

    if (existsSync(legacyErrorHandlerAlias)) {
      violations.push("http/error-handler.ts compatibility alias still exists");
    }

    expect(violations).toEqual([]);
  });
});
