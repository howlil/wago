import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const legacyRecipientsDirectory = join(sourceDirectory, "recipients");
const legacyRecipientRoute = join(sourceDirectory, "routes", "recipient.routes.ts");

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

function resolvesToLegacyRecipients(file: string, specifier: string): boolean {
  if (!specifier.startsWith(".")) return false;

  const target = relative(sourceDirectory, resolve(dirname(file), specifier))
    .replaceAll("\\", "/")
    .replace(/\.js$/, "");

  return target === "routes/recipient.routes" || target.startsWith("recipients/");
}

describe("Recipients architecture boundary", () => {
  it("keeps recipient store and routes under src/modules/recipients", () => {
    const violations: string[] = [];

    for (const file of sourceTypeScriptFiles(sourceDirectory)) {
      const relativeFile = relative(sourceDirectory, file).replaceAll("\\", "/");

      if (file.startsWith(`${legacyRecipientsDirectory}/`)) {
        violations.push(`${relativeFile} legacy recipient file still exists`);
      }
      if (file === legacyRecipientRoute) {
        violations.push(`${relativeFile} legacy recipient route file still exists`);
      }

      for (const specifier of moduleSpecifiers(readFileSync(file, "utf8"))) {
        if (resolvesToLegacyRecipients(file, specifier)) violations.push(`${relativeFile} -> ${specifier}`);
      }
    }

    expect(violations).toEqual([]);
  });
});
