import { createHash, timingSafeEqual } from "node:crypto";
import type { Request, RequestHandler } from "express";
import { isBrowserSessionValid } from "../auth/browser-session-store.js";
import { config } from "../config/index.js";

function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }

  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([key, value]) => Boolean(key) && value !== undefined)
      .map(([key, value]) => [key, decodeURIComponent(value)]),
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

function hashApiKeyCandidate(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function isApiKeyValid(token: string): boolean {
  if (config.apiKey && constantTimeEquals(token, config.apiKey)) {
    return true;
  }

  if (config.apiKeyHash && constantTimeEquals(hashApiKeyCandidate(token), config.apiKeyHash)) {
    return true;
  }

  return false;
}

export function getBrowserSessionToken(req: Request): string | null {
  return parseCookieHeader(req.header("cookie"))[config.authCookieName] ?? null;
}

export function requestHasValidBearerApiKey(req: Request): boolean {
  const header = req.header("authorization");
  const bearerToken = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  return Boolean(bearerToken && isApiKeyValid(bearerToken));
}

export function requestHasValidBrowserSession(req: Request): boolean {
  const token = getBrowserSessionToken(req);
  return Boolean(token && isBrowserSessionValid(token));
}

export function requestIsAuthenticated(req: Request): boolean {
  return requestHasValidBearerApiKey(req) || requestHasValidBrowserSession(req);
}

export const requireAuthenticatedRequest: RequestHandler = (req, res, next) => {
  if (!config.apiKey && !config.apiKeyHash) {
    return res.status(403).json({
      success: false,
      error: "API_KEY_REQUIRED",
      message: "Start the first WhatsApp pairing from the Wago dashboard to initialize gateway credentials",
    });
  }

  if (!requestIsAuthenticated(req)) {
    return res.status(401).json({
      success: false,
      error: "UNAUTHORIZED",
      message: "Invalid API key",
    });
  }

  return next();
};

export const requireApiKey = requireAuthenticatedRequest;
