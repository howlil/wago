import type { Server } from "node:http";
import { resumeWhatsAppSession, shutdownWhatsApp } from "../whatsapp.js";
import { logger } from "./logger.js";
import { flushPersistence } from "./persistence.js";

export type LifecycleDependencies = {
  exit: (code: number) => void;
  shutdownWhatsApp: () => Promise<void>;
  flushPersistence: () => Promise<void>;
};

export function startWhatsAppInBackground(initialize: () => Promise<void> = resumeWhatsAppSession): void {
  void initialize().catch((error: unknown) => {
    logger.error({ event: "wa.start_failed", error }, "Failed to initialize WhatsApp");
  });
}

export function createShutdownHandler(
  server: Server,
  dependencies: LifecycleDependencies = {
    exit: process.exit,
    shutdownWhatsApp,
    flushPersistence,
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

    // Stop accepting new HTTP work first, while keeping WhatsApp available for
    // requests that were already in flight.
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    await dependencies.shutdownWhatsApp();
    await dependencies.flushPersistence();
    dependencies.exit(0);
  };
}
