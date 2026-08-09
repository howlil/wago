import type { RequestHandler } from "express";

type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export function createRateLimit({ limit, windowMs }: RateLimitOptions): RequestHandler {
  const entries = new Map<string, RateLimitEntry>();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const entry = entries.get(key);

    if (!entry || entry.resetAt <= now) {
      entries.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;

    if (entry.count > limit) {
      return res.status(429).json({
        success: false,
        error: "RATE_LIMITED",
        message: "Too many requests. Try again later."
      });
    }

    return next();
  };
}
