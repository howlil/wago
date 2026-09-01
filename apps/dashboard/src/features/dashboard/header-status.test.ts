import { describe, expect, it } from "vitest";
import { getGatewayHeaderStatus } from "./header-status.js";

describe("gateway header status", () => {
  it("prefers overall readiness over a connected WhatsApp session", () => {
    expect(
      getGatewayHeaderStatus(
        "ok",
        { status: "degraded", checks: { whatsapp: { status: "ok" }, delivery: { status: "degraded" } } },
        "connected",
      ),
    ).toEqual({ label: "Degraded", tone: "warning" });
  });

  it("shows not ready even when WhatsApp itself is connected", () => {
    expect(
      getGatewayHeaderStatus(
        "ok",
        { status: "not_ready", checks: { whatsapp: { status: "ok" }, storage: { status: "not_ready" } } },
        "connected",
      ),
    ).toEqual({ label: "Not ready", tone: "danger" });
  });

  it("shows ready only when the readiness endpoint reports ok", () => {
    expect(getGatewayHeaderStatus("ok", { status: "ok", checks: {} }, "connected")).toEqual({
      label: "Ready",
      tone: "positive",
    });
  });

  it("keeps backend failure as the highest-priority state", () => {
    expect(getGatewayHeaderStatus("error", { status: "ok", checks: {} }, "connected")).toEqual({
      label: "Backend offline",
      tone: "danger",
    });
  });
});
