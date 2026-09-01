import type { ErrorRequestHandler } from "express";
import { logger } from "../../infrastructure/logger.js";
import { toHttpErrorResponse } from "../errors/error-response.js";

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
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
