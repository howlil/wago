import { existsSync } from "node:fs";
import { join } from "node:path";
import express from "express";
import helmet from "helmet";
import { config } from "./config/index.js";
import { errorHandler } from "./http/middleware/error-handler.js";
import { requestHasSameOrigin } from "./http/middleware/origin.js";
import { requestLogger } from "./http/middleware/request-logger.js";
import { getReadinessSnapshot } from "./modules/gateway/readiness.js";
import { messageRouter } from "./modules/messages/routes.js";
import { webhookRouter } from "./modules/webhooks/routes.js";
import { activityRouter } from "./routes/activity.routes.js";
import { appRouter } from "./routes/app.routes.js";
import { recipientRouter } from "./routes/recipient.routes.js";
import { whatsappRouter } from "./routes/whatsapp.routes.js";

export const app = express();
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
app.use((req, res, next) => {
  const stateChangingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  const hasCookieAuth = Boolean(req.header("cookie")?.includes(`${config.authCookieName}=`));
  const origin = req.header("origin");
  if (stateChangingMethods.has(req.method) && hasCookieAuth && origin && !requestHasSameOrigin(req)) {
    return res.status(403).json({
      success: false,
      error: "INVALID_ORIGIN",
      message: "Cookie-authenticated requests must come from the Wago origin",
    });
  }
  return next();
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/ready", (_req, res) => {
  const snapshot = getReadinessSnapshot();
  return res.status(snapshot.status === "not_ready" ? 503 : 200).json(snapshot);
});
app.use("/app", appRouter);
app.use("/activity", activityRouter);
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
