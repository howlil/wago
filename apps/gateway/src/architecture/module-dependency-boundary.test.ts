import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { importedSpecifiers, relativePath, resolvesUnder, typescriptFiles } from "./import-graph-test-helpers.js";

const sourceDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const messagesDirectory = join(sourceDirectory, "modules", "messages");
const whatsappDirectory = join(sourceDirectory, "modules", "whatsapp");

describe("feature module dependency boundary", () => {
  it("keeps production Messages independent from WhatsApp internals", () => {
    const violations: string[] = [];

    for (const file of typescriptFiles(messagesDirectory, { includeTests: false })) {
      for (const specifier of importedSpecifiers(file)) {
        if (resolvesUnder(file, specifier, whatsappDirectory)) {
          violations.push(`${relativePath(sourceDirectory, file)} -> ${specifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps production WhatsApp on documented public Messages boundaries", () => {
    const allowedMessagesImports = new Set(["../messages/index.js", "../messages/outbound-policy.js"]);
    const violations: string[] = [];

    for (const file of typescriptFiles(whatsappDirectory, { includeTests: false })) {
      for (const specifier of importedSpecifiers(file)) {
        if (specifier.startsWith("../messages/") && !allowedMessagesImports.has(specifier)) {
          violations.push(`${relativePath(sourceDirectory, file)} -> ${specifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
