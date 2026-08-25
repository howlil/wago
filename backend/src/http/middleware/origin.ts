import type { Request, RequestHandler } from "express";
import { config } from "../../config/index.js";

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function requestHasSameOrigin(req: Request): boolean {
  const origin = req.header("origin");
  const host = req.header("host");

  if (!origin || !host) {
    return false;
  }

  try {
    const parsedOrigin = new URL(origin);

    if (config.nodeEnv === "production" && parsedOrigin.protocol !== "https:") {
      return false;
    }

    return parsedOrigin.host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

export const requireSameOriginForCookieMutation: RequestHandler = (req, res, next) => {
  if (!STATE_CHANGING_METHODS.has(req.method)) {
    return next();
  }

  const hasCookieAuth = Boolean(req.header("cookie")?.includes(`${config.authCookieName}=`));
  const origin = req.header("origin");
  if (!hasCookieAuth || !origin || requestHasSameOrigin(req)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: "INVALID_ORIGIN",
    message: "Cookie-authenticated requests must come from the Wago origin",
  });
};
