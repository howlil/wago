import type { Request, RequestHandler } from "express";
import { config } from "../config/index.js";
import { isApiKeyConfigured, isApiKeyValid } from "../modules/access/api-key.js";
import { isBrowserSessionValid } from "../modules/access/browser-session-store.js";

function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (!header) return {};

  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([key, value]) => Boolean(key) && value !== undefined)
      .map(([key, value]) => [key, decodeURIComponent(value)]),
  );
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
  if (!isApiKeyConfigured()) {
    return res.status(403).json({
      success: false,
      error: "API_KEY_REQUIRED",
      message: "Start the first WhatsApp pairing from the Wago dashboard to initialize gateway credentials",
    });
  }

  if (!requestIsAuthenticated(req)) {
    return res.status(401).json({ success: false, error: "UNAUTHORIZED", message: "Invalid API key" });
  }

  return next();
};

export const requireApiKey = requireAuthenticatedRequest;
