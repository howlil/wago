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
  it("acquires ownership and recovers outbound state before workers exactly once", async () => {
    const events: string[] = [];
    const lease = leaseDeps();
    lease.acquireInstanceLease.mockImplementation(() => {
      events.push("lease.acquire");
      return { acquired: true };
    });
    lease.startInstanceLeaseHeartbeat.mockImplementation(() => events.push("lease.heartbeat.start"));
    const recoverInterruptedOutboundDispatches = vi.fn(() => events.push("outbound.recover"));
    const startWebhookDeliveryWorker = vi.fn(() => events.push("webhook.start"));
    const resumeWhatsAppSession = vi.fn(async () => {
      events.push("whatsapp.resume");
    });
    const lifecycle = createApplicationLifecycle({
      ...lease,
      recoverInterruptedOutboundDispatches,
      startWebhookDeliveryWorker,
      stopWebhookDeliveryWorker: async () => undefined,
      resumeWhatsAppSession,
      shutdownWhatsApp: async () => undefined,
      checkpointDatabase: () => undefined,
      closeDatabase: () => undefined,
    });

    await Promise.all([lifecycle.start(), lifecycle.start()]);
    expect(events).toEqual([
      "lease.acquire",
      "lease.heartbeat.start",
      "outbound.recover",
      "webhook.start",
      "whatsapp.resume",
    ]);
    expect(recoverInterruptedOutboundDispatches).toHaveBeenCalledTimes(1);
    expect(startWebhookDeliveryWorker).toHaveBeenCalledTimes(1);
    expect(resumeWhatsAppSession).toHaveBeenCalledTimes(1);
  });

  it("refuses startup before recovery or workers when another instance holds the lease", async () => {
    const lease = leaseDeps();
    lease.acquireInstanceLease.mockReturnValue({ acquired: false, reason: "LEASE_HELD" });
    const recoverInterruptedOutboundDispatches = vi.fn();
    const startWebhookDeliveryWorker = vi.fn();
    const resumeWhatsAppSession = vi.fn(async () => undefined);
    const lifecycle = createApplicationLifecycle({
      ...lease,
      recoverInterruptedOutboundDispatches,
      startWebhookDeliveryWorker,
      stopWebhookDeliveryWorker: async () => undefined,
      resumeWhatsAppSession,
      shutdownWhatsApp: async () => undefined,
      checkpointDatabase: () => undefined,
      closeDatabase: () => undefined,
    });

    await expect(lifecycle.start()).rejects.toBeInstanceOf(WagoInstanceAlreadyActiveError);
    expect(recoverInterruptedOutboundDispatches).not.toHaveBeenCalled();
    expect(startWebhookDeliveryWorker).not.toHaveBeenCalled();
    expect(resumeWhatsAppSession).not.toHaveBeenCalled();
  });

  it("releases the lease immediately when startup fails after acquisition", async () => {
    const lease = leaseDeps();
    const lifecycle = createApplicationLifecycle({
      ...lease,
      recoverInterruptedOutboundDispatches: () => undefined,
      startWebhookDeliveryWorker: () => {
        throw new Error("worker failed");
      },
      stopWebhookDeliveryWorker: async () => undefined,
      resumeWhatsAppSession: async () => undefined,
      shutdownWhatsApp: async () => undefined,
      checkpointDatabase: () => undefined,
      closeDatabase: () => undefined,
    });

    await expect(lifecycle.start()).rejects.toThrow("worker failed");
    expect(lease.stopInstanceLeaseHeartbeat).toHaveBeenCalledTimes(1);
    expect(lease.releaseInstanceLease).toHaveBeenCalledTimes(1);
  });

  it("releases the lease when outbound recovery fails before workers start", async () => {
    const lease = leaseDeps();
    const startWebhookDeliveryWorker = vi.fn();
    const lifecycle = createApplicationLifecycle({
      ...lease,
      recoverInterruptedOutboundDispatches: () => {
        throw new Error("recovery failed");
      },
      startWebhookDeliveryWorker,
      stopWebhookDeliveryWorker: async () => undefined,
      resumeWhatsAppSession: async () => undefined,
      shutdownWhatsApp: async () => undefined,
      checkpointDatabase: () => undefined,
      closeDatabase: () => undefined,
    });

    await expect(lifecycle.start()).rejects.toThrow("recovery failed");
    expect(startWebhookDeliveryWorker).not.toHaveBeenCalled();
    expect(lease.stopInstanceLeaseHeartbeat).toHaveBeenCalledTimes(1);
    expect(lease.releaseInstanceLease).toHaveBeenCalledTimes(1);
  });

  it("stops the webhook worker when WhatsApp resume fails during startup", async () => {
    const events: string[] = [];
    const lifecycle = createApplicationLifecycle({
      acquireInstanceLease: () => ({ acquired: true }),
      startInstanceLeaseHeartbeat: () => events.push("heartbeat.start"),
      stopInstanceLeaseHeartbeat: () => events.push("heartbeat.stop"),
      releaseInstanceLease: () => {
        events.push("lease.release");
        return true;
      },
      recoverInterruptedOutboundDispatches: () => events.push("outbound.recover"),
      startWebhookDeliveryWorker: () => events.push("webhook.start"),
      stopWebhookDeliveryWorker: async () => {
        events.push("webhook.stop");
      },
      resumeWhatsAppSession: async () => {
        events.push("whatsapp.resume");
        throw new Error("resume failed");
      },
      shutdownWhatsApp: async () => undefined,
      checkpointDatabase: () => undefined,
      closeDatabase: () => undefined,
    });

    await expect(lifecycle.start()).rejects.toThrow("resume failed");
    expect(events).toEqual([
      "heartbeat.start",
      "outbound.recover",
      "webhook.start",
      "whatsapp.resume",
      "webhook.stop",
      "heartbeat.stop",
      "lease.release",
    ]);
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
      recoverInterruptedOutboundDispatches: () => undefined,
      startWebhookDeliveryWorker: () => undefined,
      stopWebhookDeliveryWorker: async () => {
        events.push("webhook.stop");
      },
      resumeWhatsAppSession: async () => undefined,
      shutdownWhatsApp: async () => {
        events.push("whatsapp.shutdown");
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
      "lease.heartbeat.stop",
      "lease.release",
      "database.checkpoint",
      "database.close",
    ]);
  });
});
