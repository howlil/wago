import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sourceDirectory = join(process.cwd(), "src");

function source(path: string): string {
  return readFileSync(join(sourceDirectory, path), "utf8");
}

describe("dashboard snapshot boundary", () => {
  it("keeps gateway and WhatsApp snapshot state in their owning features", () => {
    const snapshotSource = source("features/dashboard/useDashboardSnapshot.ts");

    expect(existsSync(join(sourceDirectory, "features", "gateway", "useGatewaySnapshotState.ts"))).toBe(true);
    expect(existsSync(join(sourceDirectory, "features", "whatsapp", "useWhatsAppSnapshotState.ts"))).toBe(true);
    expect(existsSync(join(sourceDirectory, "features", "dashboard", "useGatewaySnapshotState.ts"))).toBe(false);
    expect(existsSync(join(sourceDirectory, "features", "dashboard", "useWhatsAppSnapshotState.ts"))).toBe(false);
    expect(snapshotSource).toContain("../gateway/useGatewaySnapshotState.js");
    expect(snapshotSource).toContain("../whatsapp/useWhatsAppSnapshotState.js");
    expect(snapshotSource).not.toContain("../gateway/api.js");
    expect(snapshotSource).not.toContain("../whatsapp/api.js");
  });
});
