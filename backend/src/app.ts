import { existsSync } from "node:fs";
import { join } from "node:path";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import { config } from "./config/index.js";
import { validateRuntimeConfig } from "./config/validation.js";
import { requestLogger } from "./middleware/request-logger.js";
import { appRouter } from "./routes/app.routes.js";
import { messageRouter } from "./routes/message.routes.js";
import { recipientRouter } from "./routes/recipient.routes.js";
import { whatsappRouter } from "./routes/whatsapp.routes.js";

export const app = express();

const configErrors = validateRuntimeConfig({
  nodeEnv: config.nodeEnv,
  corsOrigin: config.corsOrigin,
});

if (configErrors.length > 0) {
  throw new Error(`Invalid production configuration: ${configErrors.join(" ")}`);
}

app.set("trust proxy", config.trustProxy ? 1 : false);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", config.corsOrigin === "*" ? "*" : config.corsOrigin],
        imgSrc: ["'self'", "data:"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  }),
);
app.use(
  cors({
    origin: config.corsOrigin === "*" ? "*" : config.corsOrigin,
    credentials: config.corsOrigin !== "*",
  }),
);
app.use(express.json({ limit: config.bodyLimit }));
app.use(requestLogger);

app.use((req, res, next) => {
  const stateChangingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  const hasCookieAuth = Boolean(req.header("cookie")?.includes(`${config.authCookieName}=`));
  const origin = req.header("origin");

  if (
    stateChangingMethods.has(req.method) &&
    hasCookieAuth &&
    origin &&
    config.corsOrigin !== "*" &&
    origin !== config.corsOrigin
  ) {
    return res.status(403).json({
      success: false,
      error: "INVALID_ORIGIN",
      message: "Cookie-authenticated requests must come from the configured origin",
    });
  }

  return next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/ready", (_req, res) => {
  res.json({
    status: "ok",
    appId: config.appId,
    apiKeyConfigured: Boolean(config.apiKey || config.apiKeyHash),
  });
});

app.use("/app", appRouter);
app.use("/recipients", recipientRouter);
app.use("/whatsapp", whatsappRouter);
app.use("/messages", messageRouter);

const frontendDirectory = config.frontendDirectory;

if (frontendDirectory && existsSync(frontendDirectory)) {
  app.use(express.static(frontendDirectory));
  app.get(/.*/, (_req, res) => {
    res.sendFile(join(frontendDirectory, "index.html"));
  });
}

const jsonErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({
      success: false,
      error: "INVALID_JSON",
      message: "Request body must be valid JSON",
    });
  }

  if (error instanceof Error && "type" in error && error.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      error: "PAYLOAD_TOO_LARGE",
      message: "Request body is too large",
    });
  }

  return next(error);
};

app.use(jsonErrorHandler);
