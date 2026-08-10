import type { ErrorRequestHandler } from "express";
import { logger } from "../infrastructure/logger.js";
import { toHttpErrorResponse } from "./errors/error-response.js";

export const apiErrorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const mapped = toHttpErrorResponse(error);

  if (mapped) {
    return res.status(mapped.status).json(mapped.body);
  }

  logger.error(
    {
      event: "http.unhandled_error",
      method: req.method,
      path: req.path,
      errorType: error instanceof Error ? error.name : typeof error,
    },
    "Unhandled HTTP request error",
  );

  return res.status(500).json({
    success: false,
    error: "INTERNAL_ERROR",
    message: "Internal server error",
  });
};
