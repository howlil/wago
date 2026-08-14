import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const legacyTargets = new Set(["auth/browser-session-store", "infrastructure/persistence"]);
const legacySymbols = new Map([
  ["modules/activity/store.ts", "flushActivityStore"],
  ["modules/recipients/store.ts", "flushRecipientStore"],
]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!entry.isFile() || !entry.name.endsWith(".ts") || path.includes(`${join("src", "architecture")}`)) return [];
    return [path];
  });
}

function specifiers(source: string): string[] {
  return [
    ...Array.from(source.matchAll(/\bfrom\s+["']([^"']+)["']/g), (match) => match[1] ?? ""),
    ...Array.from(source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g), (match) => match[1] ?? ""),
    ...Array.from(source.matchAll(/\bvi\.mock\(\s*["']([^"']+)["']/g), (match) => match[1] ?? ""),
  ];
}

function resolvedTarget(file: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  return relative(sourceDirectory, resolve(dirname(file), specifier))
    .replaceAll("\\", "/")
    .replace(/\.js$/, "");
}

describe("backend cleanup boundary", () => {
  it("does not retain unused compatibility files or imports", () => {
    const violations: string[] = [];

    for (const target of legacyTargets) {
      if (existsSync(join(sourceDirectory, `${target}.ts`))) violations.push(`${target}.ts still exists`);
    }

    for (const [file, symbol] of legacySymbols) {
      if (readFileSync(join(sourceDirectory, file), "utf8").includes(symbol)) {
        violations.push(`${file} still exports ${symbol}`);
      }
    }

    for (const file of sourceFiles(sourceDirectory)) {
      for (const specifier of specifiers(readFileSync(file, "utf8"))) {
        const target = resolvedTarget(file, specifier);
        if (target && legacyTargets.has(target)) {
          violations.push(`${relative(sourceDirectory, file).replaceAll("\\", "/")} -> ${specifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
