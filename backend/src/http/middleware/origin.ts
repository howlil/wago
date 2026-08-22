import type { Request } from "express";
import { config } from "../../config/index.js";

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
