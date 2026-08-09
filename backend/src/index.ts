import { app } from "./app.js";
import { logger } from "./infrastructure/logger.js";
import { createShutdownHandler, startWhatsAppInBackground } from "./infrastructure/server-lifecycle.js";

const port = 3000;
const host = "0.0.0.0";

async function start(): Promise<void> {
  const server = app.listen(port, host, () => {
    logger.info({
      event: "app.listen",
      host,
      port,
    });
  });

  startWhatsAppInBackground();
  const shutdown = createShutdownHandler(server);

  process.once("SIGTERM", (signal) => {
    void shutdown(signal);
  });
  process.once("SIGINT", (signal) => {
    void shutdown(signal);
  });
}

start().catch((error: unknown) => {
  logger.error({ event: "app.start_failed", error }, "Failed to start backend");
  process.exit(1);
});
