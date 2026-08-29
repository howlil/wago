import { type Response, Router } from "express";
import { config } from "../../config/index.js";
import {
  getBrowserSessionToken,
  requestHasValidBrowserSession,
  requestIsAuthenticated,
} from "../../http/middleware/auth.js";
import { requestHasSameOrigin } from "../../http/middleware/origin.js";
import { createRateLimit } from "../../http/middleware/rate-limit.js";
import { recordActivity } from "../activity/store.js";
import { createAdminPassword, isAdminPasswordConfigured, isAdminPasswordValid } from "./admin-password.js";
import { bootstrapApiKey, getAccessSnapshot, rotateGeneratedApiKey } from "./api-key.js";
import {
  createBrowserSession,
  revokeAllBrowserSessions,
  revokeBrowserSession,
  revokeOtherBrowserSessions,
} from "./browser-session-store.js";

export const appRouter = Router();

const browserSignInRateLimit = createRateLimit({ limit: 10, windowMs: 5 * 60 * 1000 });

const browserCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.authCookieSecure,
  path: "/",
};

function setBrowserSessionCookie(res: Response, token: string): void {
  res.cookie(config.authCookieName, token, { ...browserCookieOptions, maxAge: config.browserSessionMaxAgeMs });
}

function clearBrowserSessionCookie(res: Response): void {
  res.clearCookie(config.authCookieName, browserCookieOptions);
}

appRouter.get("/info", (req, res) => {
  const access = getAccessSnapshot();
  const adminPasswordConfigured = isAdminPasswordConfigured();

  res.json({
    success: true,
    appId: access.appId,
    apiKeyRequired: true,
    apiKeyConfigured: access.apiKeyConfigured,
    apiKeySource: access.apiKeySource,
    authenticated: requestIsAuthenticated(req),
    adminPasswordConfigured,
    dashboardAuthMode: adminPasswordConfigured ? "password" : "setup",
    credentialSetupRequired: access.credentialSetupRequired,
    setupRequired: access.credentialSetupRequired,
    webBootstrapEnabled: access.webBootstrapEnabled,
  });
});

appRouter.post("/admin/setup", browserSignInRateLimit, (req, res) => {
  if (config.nodeEnv === "production" && !requestHasSameOrigin(req)) {
    return res.status(403).json({
      success: false,
      error: "INVALID_SETUP_ORIGIN",
      message: "Admin setup must come from the Wago dashboard origin.",
    });
  }

  const password = (req.body as { password?: unknown } | undefined)?.password;
  if (typeof password !== "string" || !password) {
    return res.status(400).json({
      success: false,
      error: "INVALID_ADMIN_PASSWORD",
      message: "password must be a non-empty string.",
    });
  }

  const result = createAdminPassword(password);
  if (!result.success) {
    return res.status(result.error === "ADMIN_ALREADY_CONFIGURED" ? 409 : 400).json(result);
  }

  const session = createBrowserSession();
  setBrowserSessionCookie(res, session.token);
  void recordActivity({
    level: "success",
    category: "security",
    code: "gateway.admin_account.created",
    title: "Admin account created",
    description: "The first-run admin password was hashed into durable Wago state and a browser session was created.",
  });

  return res.status(201).json({
    success: true,
    authenticated: true,
    expiresAt: new Date(session.expiresAt).toISOString(),
    message: "Admin account created. Continue with WhatsApp pairing; no environment credential is required.",
  });
});

appRouter.post("/bootstrap", (req, res) => {
  const requestedApiKey = (req.body as { apiKey?: unknown } | undefined)?.apiKey;
  if (requestedApiKey !== undefined && typeof requestedApiKey !== "string") {
    return res
      .status(400)
      .json({ success: false, error: "INVALID_API_KEY", message: "apiKey must be a string when provided." });
  }

  if (config.nodeEnv === "production" && !requestHasSameOrigin(req)) {
    return res.status(403).json({
      success: false,
      error: "INVALID_SETUP_ORIGIN",
      message: "First-run setup must come from the Wago dashboard origin.",
    });
  }

  if (config.nodeEnv === "production" && !requestHasValidBrowserSession(req)) {
    return res.status(403).json({
      success: false,
      error: "BROWSER_SESSION_REQUIRED",
      message: "Create or sign in to the admin account before managing machine API credentials.",
    });
  }

  const result = bootstrapApiKey(requestedApiKey);
  if (!result.success) return res.status(result.error === "INVALID_API_KEY" ? 400 : 409).json(result);

  let sessionExpiresAt: string | undefined;
  if (!requestHasValidBrowserSession(req)) {
    const session = createBrowserSession();
    setBrowserSessionCookie(res, session.token);
    sessionExpiresAt = new Date(session.expiresAt).toISOString();
  }

  void recordActivity({
    level: "success",
    category: "security",
    code: result.recovered ? "gateway.credentials.recovered" : "gateway.initialized",
    title: result.recovered ? "Gateway API access restored" : "Gateway API initialized",
    description: result.recovered
      ? "The existing machine API key was verified without changing dashboard authentication."
      : "A machine API key was created separately from dashboard authentication.",
  });

  return res.status(result.recovered ? 200 : 201).json({
    success: true,
    appId: result.appId,
    apiKey: result.apiKey,
    recovered: result.recovered,
    sessionExpiresAt,
    message: result.recovered
      ? "Machine API credentials verified."
      : "Machine API key generated. Save it for external API clients, then continue with WhatsApp pairing.",
  });
});

appRouter.post("/session", browserSignInRateLimit, (req, res) => {
  if (config.nodeEnv === "production" && !requestHasSameOrigin(req)) {
    return res.status(403).json({
      success: false,
      error: "INVALID_SESSION_ORIGIN",
      message: "Browser sign-in must come from the Wago dashboard origin.",
    });
  }

  if (!isAdminPasswordConfigured()) {
    return res.status(409).json({
      success: false,
      error: "ADMIN_SETUP_REQUIRED",
      message: "Create the admin account from the Wago dashboard before signing in.",
    });
  }

  const password = (req.body as { password?: unknown } | undefined)?.password;
  if (typeof password !== "string" || !password) {
    return res.status(400).json({
      success: false,
      error: "INVALID_ADMIN_PASSWORD",
      message: "password must be a non-empty string.",
    });
  }
  if (!isAdminPasswordValid(password)) {
    return res.status(401).json({ success: false, error: "UNAUTHORIZED", message: "Invalid admin password" });
  }

  const session = createBrowserSession();
  setBrowserSessionCookie(res, session.token);
  void recordActivity({
    level: "success",
    category: "security",
    code: "gateway.browser_session.created",
    title: "Browser session created",
    description: "The dashboard authenticated with the admin password and received a browser session.",
  });
  return res.json({
    success: true,
    authenticated: true,
    expiresAt: new Date(session.expiresAt).toISOString(),
    message: "Browser session created.",
  });
});

appRouter.post("/api-key/rotate", (req, res) => {
  if (!requestHasValidBrowserSession(req)) {
    return res.status(401).json({
      success: false,
      error: "BROWSER_SESSION_REQUIRED",
      message: "API key rotation requires an authenticated Wago dashboard session.",
    });
  }
  if (config.nodeEnv === "production" && !requestHasSameOrigin(req)) {
    return res.status(403).json({
      success: false,
      error: "INVALID_ROTATION_ORIGIN",
      message: "API key rotation must come from the Wago dashboard origin.",
    });
  }

  const currentToken = getBrowserSessionToken(req);
  const result = rotateGeneratedApiKey();
  if (!result.success) return res.status(409).json(result);
  const revokedSessions = currentToken ? revokeOtherBrowserSessions(currentToken) : 0;

  void recordActivity({
    level: "warning",
    category: "security",
    code: "gateway.api_key.rotated",
    title: "API key rotated",
    description:
      "The machine API key was rotated, other dashboard sessions were revoked, and the current recovery session remains active.",
    metadata: { revokedBrowserSessions: revokedSessions },
  });

  return res.json({
    success: true,
    apiKey: result.apiKey,
    generatedAt: result.generatedAt,
    revokedBrowserSessions: revokedSessions,
    message: "API key rotated. Save it now; the previous key and other dashboard sessions are no longer valid.",
  });
});

appRouter.post("/session/logout", (req, res) => {
  const token = getBrowserSessionToken(req);
  if (token) revokeBrowserSession(token);
  clearBrowserSessionCookie(res);
  void recordActivity({
    level: "info",
    category: "security",
    code: "gateway.browser_session.revoked",
    title: "Browser session ended",
    description: "The current dashboard browser session was revoked.",
  });
  return res.json({ success: true, authenticated: false, message: "Browser session ended." });
});

appRouter.post("/session/logout-all", (req, res) => {
  if (!requestHasValidBrowserSession(req)) {
    return res.status(401).json({
      success: false,
      error: "BROWSER_SESSION_REQUIRED",
      message: "Sign-out-all requires an authenticated Wago dashboard session.",
    });
  }
  if (config.nodeEnv === "production" && !requestHasSameOrigin(req)) {
    return res.status(403).json({
      success: false,
      error: "INVALID_SESSION_ORIGIN",
      message: "Dashboard session changes must come from the Wago dashboard origin.",
    });
  }

  const revokedSessions = revokeAllBrowserSessions();
  clearBrowserSessionCookie(res);
  void recordActivity({
    level: "warning",
    category: "security",
    code: "gateway.browser_sessions.revoked_all",
    title: "All browser sessions ended",
    description:
      "Every dashboard browser session was revoked. Machine API credentials and WhatsApp auth were not changed.",
    metadata: { revokedBrowserSessions: revokedSessions },
  });
  return res.json({
    success: true,
    authenticated: false,
    revokedBrowserSessions: revokedSessions,
    message: "All browser sessions ended.",
  });
});
