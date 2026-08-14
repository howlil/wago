import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const legacyWhatsAppDirectory = join(sourceDirectory, "whatsapp");
const legacyFacade = join(sourceDirectory, "whatsapp.ts");

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

function resolvesToLegacyWhatsApp(file: string, specifier: string): boolean {
  if (!specifier.startsWith(".")) return false;

  const target = relative(sourceDirectory, resolve(dirname(file), specifier))
    .replaceAll("\\", "/")
    .replace(/\.js$/, "");

  return target === "whatsapp" || target.startsWith("whatsapp/");
}

describe("WhatsApp architecture boundary", () => {
  it("keeps production WhatsApp ownership under src/modules/whatsapp", () => {
    const violations: string[] = [];

    for (const file of productionTypeScriptFiles(sourceDirectory)) {
      const relativeFile = relative(sourceDirectory, file).replaceAll("\\", "/");

      if (file.startsWith(`${legacyWhatsAppDirectory}/`)) {
        violations.push(`${relativeFile} legacy WhatsApp file still exists`);
      }

      for (const specifier of staticImports(readFileSync(file, "utf8"))) {
        if (resolvesToLegacyWhatsApp(file, specifier)) {
          violations.push(`${relativeFile} -> ${specifier}`);
        }
      }
    }

    if (existsSync(legacyFacade)) {
      violations.push("whatsapp.ts legacy facade still exists");
    }

    expect(violations).toEqual([]);
  });
});
