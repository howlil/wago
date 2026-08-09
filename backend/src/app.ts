import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config.js";
import { requestLogger } from "./middleware/request-logger.js";
import { appRouter } from "./routes/app.routes.js";
import { messageRouter } from "./routes/message.routes.js";
import { whatsappRouter } from "./routes/whatsapp.routes.js";

export const app = express();

app.set("trust proxy", 1);
app.use(
  cors({
    origin: config.corsOrigin === "*" ? "*" : config.corsOrigin,
    credentials: config.corsOrigin !== "*"
  })
);
app.use(express.json({ limit: config.bodyLimit }));
app.use(requestLogger);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/ready", (_req, res) => {
  res.json({
    status: "ok",
    appId: config.appId,
    apiKeyConfigured: Boolean(config.apiKey)
  });
});

app.use("/app", appRouter);
app.use("/whatsapp", whatsappRouter);
app.use("/messages", messageRouter);

if (config.frontendDirectory && existsSync(config.frontendDirectory)) {
  app.use(express.static(config.frontendDirectory));
  app.get(/.*/, (_req, res) => {
    res.sendFile(join(config.frontendDirectory!, "index.html"));
  });
}

const jsonErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({
      success: false,
      error: "INVALID_JSON",
      message: "Request body must be valid JSON"
    });
  }

  if (error instanceof Error && "type" in error && error.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      error: "PAYLOAD_TOO_LARGE",
      message: "Request body is too large"
    });
  }

  return next(error);
};

app.use(jsonErrorHandler);
