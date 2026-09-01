import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const frontendDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const controllerPath = join(frontendDirectory, "src", "features", "dashboard", "useDashboardController.ts");

describe("dashboard controller boundary", () => {
  it("delegates gateway and WhatsApp mutations to focused action hooks", () => {
    const source = readFileSync(controllerPath, "utf8");

    expect(source).not.toContain('from "../gateway/api.js"');
    expect(source).not.toContain('from "../whatsapp/api.js"');
    expect(source).toContain('from "./useGatewayAccessActions.js"');
    expect(source).toContain('from "./useWhatsAppBindingActions.js"');
  });
});
