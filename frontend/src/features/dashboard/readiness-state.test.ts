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

  it("gives a recovery action for credential persistence degradation", () => {
    expect(getOperationalReadinessWarning(snapshot("degraded", "credential_persistence_failed"))).toEqual({
      tone: "warning",
      message: "WhatsApp credential updates are not persisting. Check /app/data filesystem health before any restart.",
    });
  });

  it("treats lost instance ownership as a control-plane danger", () => {
    expect(getOperationalReadinessWarning(snapshot("not_ready", "instance_ownership_lost"))).toEqual({
      tone: "danger",
      message: "This process lost single-instance ownership. Stop duplicate Wago replicas and restart only one owner.",
    });
  });
});
