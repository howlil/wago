import { timingSafeEqual } from "node:crypto";
import type { Request, RequestHandler } from "express";
import { config } from "../config.js";

function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }

  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([key, value]) => Boolean(key) && value !== undefined)
      .map(([key, value]) => [key, decodeURIComponent(value)])
  );
}

function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function requestHasValidApiKey(req: Request): boolean {
  if (!config.apiKey) {
    return false;
  }

  const header = req.header("authorization");
  const bearerToken = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  const cookieToken = parseCookieHeader(req.header("cookie"))[config.authCookieName];

  return [bearerToken, cookieToken].some((token) => token && constantTimeEquals(token, config.apiKey!));
}

export const requireApiKey: RequestHandler = (req, res, next) => {
  if (!config.apiKey) {
    return res.status(403).json({
      success: false,
      error: "API_KEY_REQUIRED",
      message: "Initialize the app from the web UI or set API_KEY on the backend before using this operation"
    });
  }

  if (!requestHasValidApiKey(req)) {
    return res.status(401).json({
      success: false,
      error: "UNAUTHORIZED",
      message: "Invalid API key"
    });
  }

  return next();
};
