import { existsSync } from "node:fs";
import { join } from "node:path";
import express from "express";
import helmet from "helmet";
import { createHttpComposition } from "./app/composition.js";
import { config } from "./config/index.js";
import { errorHandler } from "./http/middleware/error-handler.js";
import { requireSameOriginForCookieMutation } from "./http/middleware/origin.js";
import { requestLogger } from "./http/middleware/request-logger.js";
import { appRouter } from "./modules/access/routes.js";
import { activityRouter } from "./modules/activity/routes.js";
import { getReadinessSnapshot } from "./modules/gateway/readiness.js";
import { metricsRouter } from "./modules/metrics/routes.js";
import { recipientRouter } from "./modules/recipients/routes.js";
import { webhookRouter } from "./modules/webhooks/routes.js";
import { whatsappRouter } from "./modules/whatsapp/routes.js";

export const app = express();
const { messageRouter } = createHttpComposition();

app.set("trust proxy", config.trustProxy ? 1 : false);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  }),
);
app.use(express.json({ limit: config.bodyLimit }));
app.use(requestLogger);
app.use(requireSameOriginForCookieMutation);

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/ready", (_req, res) => {
  const snapshot = getReadinessSnapshot();
  return res.status(snapshot.status === "not_ready" ? 503 : 200).json(snapshot);
});
app.use("/app", appRouter);
app.use("/activity", activityRouter);
app.use("/metrics", metricsRouter);
app.use("/recipients", recipientRouter);
app.use("/whatsapp", whatsappRouter);
app.use("/messages", messageRouter);
app.use("/webhooks", webhookRouter);

const frontendDirectory = config.frontendDirectory;
if (frontendDirectory && existsSync(frontendDirectory)) {
  app.use(express.static(frontendDirectory));
  app.get(/.*/, (_req, res) => res.sendFile(join(frontendDirectory, "index.html")));
}
app.use(errorHandler);
