import type { RequestHandler } from "express";
import { config } from "../config.js";

export const requestLogger: RequestHandler = (req, res, next) => {
  if (!config.requestLogging) {
    return next();
  }

  const startedAt = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
  });

  return next();
};
