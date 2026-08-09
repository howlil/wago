import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { config } from "../config/index.js";
import { logger } from "../infrastructure/logger.js";

function getRouteName(req: Parameters<RequestHandler>[0]): string {
  const routePath = req.route?.path;

  if (typeof routePath === "string") {
    return `${req.baseUrl}${routePath}`;
  }

  return req.path;
}

export const requestLogger: RequestHandler = (req, res, next) => {
  if (!config.requestLogging) {
    return next();
  }

  const startedAt = Date.now();
  const requestId = req.header("x-request-id")?.trim() || randomUUID();

  res.setHeader("X-Request-Id", requestId);

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    logger.info({
      event: "http.request",
      requestId,
      method: req.method,
      route: getRouteName(req),
      status: res.statusCode,
      durationMs,
    });
  });

  return next();
};
