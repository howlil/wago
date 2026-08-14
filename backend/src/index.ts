import { recordActivity } from "./activity/store.js";
import { createApplicationLifecycle } from "./app/lifecycle.js";
import { app } from "./app.js";
import { checkpointDatabase, closeDatabase, getDatabase } from "./infrastructure/database.js";
import { createInstanceLeaseManager } from "./infrastructure/instance-lease.js";
import { logger } from "./infrastructure/logger.js";
import { flushOutboundPolicyPersistence } from "./policy/outbound-policy.js";
import { startWebhookDeliveryWorker, stopWebhookDeliveryWorker } from "./webhooks/delivery-webhook.js";
import { resumeWhatsAppSession, shutdownWhatsApp } from "./whatsapp.js";

const port = 3000;
const host = "0.0.0.0";

const instanceLease = createInstanceLeaseManager(getDatabase(), {
  onOwnershipLost: () => {
    logger.error({ event: "app.instance_lease_lost", code: "WAGO_INSTANCE_LEASE_LOST" });
    process.kill(process.pid, "SIGTERM");
  },
});

const lifecycle = createApplicationLifecycle({
  acquireInstanceLease: () => instanceLease.acquire(),
  startInstanceLeaseHeartbeat: () => instanceLease.startHeartbeat(),
  stopInstanceLeaseHeartbeat: () => instanceLease.stopHeartbeat(),
  releaseInstanceLease: () => instanceLease.release(),
  startWebhookDeliveryWorker,
  stopWebhookDeliveryWorker,
  resumeWhatsAppSession,
  shutdownWhatsApp,
  flushOutboundPolicyPersistence,
  checkpointDatabase,
  closeDatabase,
});

async function start(): Promise<void> {
  await lifecycle.start();

  const server = app.listen(port, host, () => {
    logger.info({
      event: "app.listen",
      host,
      port,
    });

    void recordActivity({
      level: "info",
      category: "system",
      code: "gateway.started",
      title: "Gateway started",
      description: "The Wago backend started successfully and is ready to serve the dashboard and API.",
    });
  });

  let shutdownStarted = false;
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shutdownStarted) return;
    shutdownStarted = true;

    logger.info({ event: "app.shutdown", signal });

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    await lifecycle.stop(signal);
  };

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void shutdown(signal)
        .then(() => process.exit(0))
        .catch((error: unknown) => {
          logger.error({ event: "app.shutdown_failed", errorType: error instanceof Error ? error.name : typeof error });
          process.exit(1);
        });
    });
  }
}

start().catch((error: unknown) => {
  const errorCode = typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined;
  logger.error({ event: "app.start_failed", errorType: error instanceof Error ? error.name : typeof error, errorCode });
  process.exit(1);
});
