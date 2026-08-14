import { describe, expect, it, vi } from "vitest";
import { WagoInstanceAlreadyActiveError } from "../infrastructure/instance-lease.js";
import { createApplicationLifecycle } from "./lifecycle.js";

function leaseDeps() {
  return {
    acquireInstanceLease: vi.fn(() => ({ acquired: true as const })),
    startInstanceLeaseHeartbeat: vi.fn(),
    stopInstanceLeaseHeartbeat: vi.fn(),
    releaseInstanceLease: vi.fn(() => true),
  };
}

describe("application lifecycle", () => {
  it("acquires ownership before starting webhook recovery and WhatsApp exactly once", async () => {
    const events: string[] = [];
    const lease = leaseDeps();
    lease.acquireInstanceLease.mockImplementation(() => {
      events.push("lease.acquire");
      return { acquired: true };
    });
    lease.startInstanceLeaseHeartbeat.mockImplementation(() => events.push("lease.heartbeat.start"));
    const startWebhookDeliveryWorker = vi.fn(() => events.push("webhook.start"));
    const resumeWhatsAppSession = vi.fn(async () => {
      events.push("whatsapp.resume");
    });
    const lifecycle = createApplicationLifecycle({
      ...lease,
      startWebhookDeliveryWorker,
      stopWebhookDeliveryWorker: async () => undefined,
      resumeWhatsAppSession,
      shutdownWhatsApp: async () => undefined,
      flushOutboundPolicyPersistence: async () => undefined,
      checkpointDatabase: () => undefined,
      closeDatabase: () => undefined,
    });

    await Promise.all([lifecycle.start(), lifecycle.start()]);
    expect(events).toEqual(["lease.acquire", "lease.heartbeat.start", "webhook.start", "whatsapp.resume"]);
    expect(startWebhookDeliveryWorker).toHaveBeenCalledTimes(1);
    expect(resumeWhatsAppSession).toHaveBeenCalledTimes(1);
  });

  it("refuses startup before workers when another instance holds the lease", async () => {
    const lease = leaseDeps();
    lease.acquireInstanceLease.mockReturnValue({ acquired: false, reason: "LEASE_HELD" });
    const startWebhookDeliveryWorker = vi.fn();
    const resumeWhatsAppSession = vi.fn(async () => undefined);
    const lifecycle = createApplicationLifecycle({
      ...lease,
      startWebhookDeliveryWorker,
      stopWebhookDeliveryWorker: async () => undefined,
      resumeWhatsAppSession,
      shutdownWhatsApp: async () => undefined,
      flushOutboundPolicyPersistence: async () => undefined,
      checkpointDatabase: () => undefined,
      closeDatabase: () => undefined,
    });

    await expect(lifecycle.start()).rejects.toBeInstanceOf(WagoInstanceAlreadyActiveError);
    expect(startWebhookDeliveryWorker).not.toHaveBeenCalled();
    expect(resumeWhatsAppSession).not.toHaveBeenCalled();
  });

  it("stops in deterministic order and cleanup runs only once", async () => {
    const events: string[] = [];
    const lifecycle = createApplicationLifecycle({
      acquireInstanceLease: () => ({ acquired: true }),
      startInstanceLeaseHeartbeat: () => undefined,
      stopInstanceLeaseHeartbeat: () => events.push("lease.heartbeat.stop"),
      releaseInstanceLease: () => {
        events.push("lease.release");
        return true;
      },
      startWebhookDeliveryWorker: () => undefined,
      stopWebhookDeliveryWorker: async () => {
        events.push("webhook.stop");
      },
      resumeWhatsAppSession: async () => undefined,
      shutdownWhatsApp: async () => {
        events.push("whatsapp.shutdown");
      },
      flushOutboundPolicyPersistence: async () => {
        events.push("policy.flush");
      },
      checkpointDatabase: () => {
        events.push("database.checkpoint");
      },
      closeDatabase: () => {
        events.push("database.close");
      },
    });

    await Promise.all([lifecycle.stop("test"), lifecycle.stop("test")]);

    expect(events).toEqual([
      "webhook.stop",
      "whatsapp.shutdown",
      "policy.flush",
      "lease.heartbeat.stop",
      "lease.release",
      "database.checkpoint",
      "database.close",
    ]);
  });
});
