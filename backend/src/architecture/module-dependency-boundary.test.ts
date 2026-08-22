import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const messagesDirectory = join(sourceDirectory, "modules", "messages");
const whatsappDirectory = join(sourceDirectory, "modules", "whatsapp");

function productionTypeScriptFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];

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

function moduleSpecifiers(source: string): string[] {
  const staticImports = Array.from(source.matchAll(/\bfrom\s+["']([^"']+)["']/g), (match) => match[1] ?? "");
  const sideEffectImports = Array.from(source.matchAll(/\bimport\s+["']([^"']+)["']/g), (match) => match[1] ?? "");
  const dynamicImports = Array.from(source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g), (match) => match[1] ?? "");

  return [...staticImports, ...sideEffectImports, ...dynamicImports];
}

function resolvesUnder(file: string, specifier: string, directory: string): boolean {
  if (!specifier.startsWith(".")) return false;

  const target = resolve(dirname(file), specifier.replace(/\.js$/, ""));
  return target === directory || target.startsWith(`${directory}/`);
}

describe("feature module dependency boundary", () => {
  it("keeps production Messages independent from WhatsApp internals", () => {
    const violations: string[] = [];

    for (const file of productionTypeScriptFiles(messagesDirectory)) {
      const relativeFile = relative(sourceDirectory, file).replaceAll("\\", "/");

      for (const specifier of moduleSpecifiers(readFileSync(file, "utf8"))) {
        if (resolvesUnder(file, specifier, whatsappDirectory)) {
          violations.push(`${relativeFile} -> ${specifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
