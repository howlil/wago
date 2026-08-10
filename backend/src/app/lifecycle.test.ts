import { describe, expect, it, vi } from "vitest";
import { createApplicationLifecycle } from "./lifecycle.js";

describe("application lifecycle", () => {
  it("starts WhatsApp exactly once", async () => {
    const resumeWhatsAppSession = vi.fn(async () => undefined);
    const lifecycle = createApplicationLifecycle({
      resumeWhatsAppSession,
      shutdownWhatsApp: async () => undefined,
      flushOutboundPolicyPersistence: async () => undefined,
      checkpointDatabase: () => undefined,
      closeDatabase: () => undefined,
    });

    await Promise.all([lifecycle.start(), lifecycle.start()]);
    expect(resumeWhatsAppSession).toHaveBeenCalledTimes(1);
  });

  it("stops in deterministic order and cleanup runs only once", async () => {
    const events: string[] = [];
    const lifecycle = createApplicationLifecycle({
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
      "whatsapp.shutdown",
      "policy.flush",
      "database.checkpoint",
      "database.close",
    ]);
  });
});
