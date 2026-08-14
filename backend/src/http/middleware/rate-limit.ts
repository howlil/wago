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

function cleanupExpiredEntries(entries: Map<string, RateLimitEntry>, now: number): void {
  for (const [key, entry] of entries) {
    if (entry.resetAt <= now) {
      entries.delete(key);
    }
  }
}

function trimOldestEntries(entries: Map<string, RateLimitEntry>, maxEntries: number): void {
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
      cleanupExpiredEntries(entries, now);
      nextCleanupAt = now + windowMs;
    }

    const key = req.ip || req.socket.remoteAddress || "unknown";
    const entry = entries.get(key);

    if (!entry || entry.resetAt <= now) {
      entries.set(key, { count: 1, resetAt: now + windowMs });
      trimOldestEntries(entries, maxEntries);
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
