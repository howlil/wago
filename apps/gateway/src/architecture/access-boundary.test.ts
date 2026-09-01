import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { importedSpecifiers, relativePath, typescriptFiles } from "./import-graph-test-helpers.js";

const sourceDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const legacyAccessRoute = join(sourceDirectory, "routes", "app.routes.ts");

function resolvesToLegacyAccessRoute(file: string, specifier: string): boolean {
  if (!specifier.startsWith(".")) {
    return false;
  }

  return (
    relativePath(sourceDirectory, resolve(dirname(file), specifier)).replace(/\.js$/, ".ts") === "routes/app.routes.ts"
  );
}

describe("Access architecture boundary", () => {
  it("keeps Access route ownership under src/modules/access", () => {
    const violations: string[] = [];
    const sourceFiles = typescriptFiles(sourceDirectory).filter(
      (file) => !relativePath(sourceDirectory, file).startsWith("architecture/"),
    );

    for (const file of sourceFiles) {
      for (const specifier of importedSpecifiers(file)) {
        if (resolvesToLegacyAccessRoute(file, specifier)) {
          violations.push(`${relativePath(sourceDirectory, file)} -> ${specifier}`);
        }
      }
    }

    if (existsSync(legacyAccessRoute)) {
      violations.push("routes/app.routes.ts legacy access route still exists");
    }

    expect(violations).toEqual([]);
  });
});
