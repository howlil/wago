import { beforeEach, describe, expect, it } from "vitest";
import { config } from "../../config/index.js";
import { getDatabase } from "../../infrastructure/database.js";
import { createWebhookSettingsStore } from "../../webhooks/settings-store.js";
import { resetCredentialPersistenceHealthForTest } from "../../whatsapp/credential-persistence-health.js";
import { getReadinessSnapshot } from "./readiness.js";

const webhookSettingsStore = createWebhookSettingsStore(getDatabase());
const unbound = {
  status: "disconnected" as const,
  binding: { state: "unbound" as const, jid: null, phone: null, boundAt: null },
  accountHealth: { availability: "unavailable" as const, unavailableReason: "session_invalid" as const },
};
const boundDisconnected = {
  status: "disconnected" as const,
  binding: { state: "bound" as const, jid: "6281000000000@s.whatsapp.net", phone: "6281000000000", boundAt: "2026-08-14T00:00:00.000Z" },
  accountHealth: { availability: "unavailable" as const, unavailableReason: "not_connected" as const },
};

describe("gateway readiness", () => {
  beforeEach(() => {
    config.apiKey = null;
    config.apiKeyHash = null;
    config.apiKeySource = "unset";
    config.nodeEnv = "test";
    webhookSettingsStore.clear();
    resetCredentialPersistenceHealthForTest();
  });

  it("treats first-run unpaired state as usable rather than degraded", () => {
    const snapshot = getReadinessSnapshot({ whatsapp: unbound, instanceLeaseState: "owned" });
    expect(snapshot.status).toBe("ok");
    expect(snapshot.apiKeyConfigured).toBe(false);
    expect(snapshot.checks.apiKey.reason).toBe("setup_required");
    expect(snapshot.checks.whatsapp.reason).toBe("pairing_not_completed");
  });

  it("reports credential persistence failure as degraded and recoverable", () => {
    const snapshot = getReadinessSnapshot({
      whatsapp: { ...boundDisconnected, status: "connected" },
      instanceLeaseState: "owned",
      credentialPersistence: { status: "degraded", consecutiveFailures: 2, lastSuccessAt: null, lastFailureAt: "2026-08-14T00:00:00.000Z" },
    });
    expect(snapshot.status).toBe("degraded");
    expect(snapshot.checks.credentialPersistence).toEqual({ status: "degraded", reason: "credential_persistence_failed" });
  });

  it("reports a bound disconnected WhatsApp session as degraded", () => {
    const snapshot = getReadinessSnapshot({ whatsapp: boundDisconnected, instanceLeaseState: "owned" });
    expect(snapshot.status).toBe("degraded");
    expect(snapshot.checks.whatsapp.reason).toBe("bound_session_disconnected");
  });

  it("reports core storage or instance ownership failure as not ready", () => {
    const storageFailure = getReadinessSnapshot({ storage: { status: "not_ready", reason: "persistent_storage_unavailable" }, whatsapp: unbound, instanceLeaseState: "owned" });
    const ownershipFailure = getReadinessSnapshot({ whatsapp: unbound, instanceLeaseState: "lost" });
    expect(storageFailure.status).toBe("not_ready");
    expect(ownershipFailure.status).toBe("not_ready");
    expect(ownershipFailure.checks.instanceLease.reason).toBe("instance_ownership_lost");
  });
});
