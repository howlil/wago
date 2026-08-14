import type { RequestHandler } from "express";

type RateLimitOptions = {
  limit: number;
  windowMs: number;
  maxEntries?: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

function cleanupExpiredEntries(entries: Map<string, RateLimitEntry>, now: number, maxEntries: number): void {
  for (const [key, entry] of entries) {
    if (entry.resetAt <= now) {
      entries.delete(key);
    }
  }

  while (entries.size > maxEntries) {
    const oldestKey = entries.keys().next().value as string | undefined;

    if (!oldestKey) {
      return;
    }

    entries.delete(oldestKey);
  }
}

export function createRateLimit({ limit, windowMs, maxEntries = 1000 }: RateLimitOptions): RequestHandler {
  const entries = new Map<string, RateLimitEntry>();
  let nextCleanupAt = 0;

  return (req, res, next) => {
    const now = Date.now();

    if (now >= nextCleanupAt) {
      cleanupExpiredEntries(entries, now, maxEntries);
      nextCleanupAt = now + windowMs;
    }

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
        message: "Too many requests. Try again later.",
      });
    }

    return next();
  };
}
