import { describe, expect, it } from "vitest";
import { type GatewayReadinessSnapshot, getOperationalReadinessWarning } from "./readiness-state.js";

function snapshot(status: GatewayReadinessSnapshot["status"], reason?: string): GatewayReadinessSnapshot {
  return {
    status,
    checks: {
      target: { status, ...(reason ? { reason } : {}) },
    },
  };
}

describe("operational readiness warning", () => {
  it("stays silent for healthy readiness", () => {
    expect(getOperationalReadinessWarning(snapshot("ok"))).toBeNull();
  });

  it("guides credential persistence degradation into system warnings", () => {
    expect(getOperationalReadinessWarning(snapshot("degraded", "credential_persistence_failed"))).toEqual({
      tone: "warning",
      message: "WhatsApp credential updates are not persisting. Check /app/data filesystem health before any restart.",
      auditHref: "/audit?category=system&level=warning",
    });
  });

  it("guides disconnected sessions into WhatsApp connection warnings", () => {
    expect(getOperationalReadinessWarning(snapshot("degraded", "bound_session_disconnected"))).toEqual({
      tone: "warning",
      message:
        "The bound WhatsApp session is disconnected. Inspect connection events; rebind only if the session is invalid.",
      auditHref: "/audit?category=connection&level=warning",
    });
  });

  it("treats lost instance ownership as a system error investigation", () => {
    expect(getOperationalReadinessWarning(snapshot("not_ready", "instance_ownership_lost"))).toEqual({
      tone: "danger",
      message: "This process lost single-instance ownership. Stop duplicate Wago replicas and restart only one owner.",
      auditHref: "/audit?category=system&level=error",
    });
  });
});
