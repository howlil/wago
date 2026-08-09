import type { Server } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { createShutdownHandler, startWhatsAppInBackground } from "./server-lifecycle.js";

function createServerMock(): Server & { closeMock: ReturnType<typeof vi.fn> } {
  const closeMock = vi.fn((callback?: (error?: Error) => void) => {
    callback?.();
    return {} as Server;
  });

  return {
    close: closeMock,
    closeMock,
  } as unknown as Server & { closeMock: ReturnType<typeof vi.fn> };
}

describe("startWhatsAppInBackground", () => {
  it("starts WhatsApp asynchronously without surfacing initialization failures", async () => {
    const initialize = vi.fn(async () => {
      throw new Error("init failed");
    });

    expect(() => startWhatsAppInBackground(initialize)).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));

    expect(initialize).toHaveBeenCalledTimes(1);
  });
});

describe("createShutdownHandler", () => {
  it("shuts down WhatsApp, closes the server, and exits once", async () => {
    const server = createServerMock();
    const exit = vi.fn();
    const shutdownWhatsApp = vi.fn(async () => undefined);
    const shutdown = createShutdownHandler(server, {
      exit,
      shutdownWhatsApp,
    });

    await shutdown("SIGTERM");
    await shutdown("SIGINT");

    expect(shutdownWhatsApp).toHaveBeenCalledTimes(1);
    expect(server.closeMock).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
    expect(exit).toHaveBeenCalledTimes(1);
  });
});
