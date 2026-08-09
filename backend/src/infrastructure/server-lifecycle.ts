import type { Server } from "node:http";
import { initializeWhatsApp, shutdownWhatsApp } from "../whatsapp.js";
import { logger } from "./logger.js";

export type LifecycleDependencies = {
  exit: (code: number) => void;
  shutdownWhatsApp: () => Promise<void>;
};

export function startWhatsAppInBackground(initialize: () => Promise<void> = initializeWhatsApp): void {
  void initialize().catch((error: unknown) => {
    logger.error({ event: "wa.start_failed", error }, "Failed to initialize WhatsApp");
  });
}

export function createShutdownHandler(
  server: Server,
  dependencies: LifecycleDependencies = {
    exit: process.exit,
    shutdownWhatsApp,
  },
): (signal: NodeJS.Signals) => Promise<void> {
  let shutdownStarted = false;

  return async (signal: NodeJS.Signals): Promise<void> => {
    if (shutdownStarted) {
      return;
    }

    shutdownStarted = true;
    logger.info({
      event: "app.shutdown",
      signal,
    });

    await dependencies.shutdownWhatsApp();

    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });

    dependencies.exit(0);
  };
}
