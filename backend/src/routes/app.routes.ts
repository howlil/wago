import { type Response, Router } from "express";
import { recordActivity } from "../activity/store.js";
import { createBrowserSession, revokeBrowserSession } from "../auth/browser-session-store.js";
import { bootstrapApiKey, config } from "../config/index.js";
import { getBrowserSessionToken, isApiKeyValid, requestIsAuthenticated } from "../middleware/auth.js";
import { requestHasSameOrigin } from "../middleware/origin.js";

export const appRouter = Router();

const browserCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.authCookieSecure,
  path: "/",
};

function clearLegacyApiKeyCookie(res: Response): void {
  res.clearCookie(config.legacyAuthCookieName, browserCookieOptions);
}

function setBrowserSessionCookie(res: Response, token: string): void {
  res.cookie(config.authCookieName, token, {
    ...browserCookieOptions,
    maxAge: config.browserSessionMaxAgeMs,
  });
  clearLegacyApiKeyCookie(res);
}

function clearBrowserSessionCookie(res: Response): void {
  res.clearCookie(config.authCookieName, browserCookieOptions);
  clearLegacyApiKeyCookie(res);
}

appRouter.get("/info", (req, res) => {
  const credentialSetupRequired = !config.apiKey && !config.apiKeyHash;

  if (req.header("cookie")?.includes(`${config.legacyAuthCookieName}=`)) {
    clearLegacyApiKeyCookie(res);
  }

  res.json({
    success: true,
    appId: config.appId,
    apiKeyRequired: true,
    apiKeyConfigured: !credentialSetupRequired,
    apiKeySource: config.apiKeySource,
    authenticated: requestIsAuthenticated(req),
    credentialSetupRequired,
    setupRequired: credentialSetupRequired,
  });
});

appRouter.post("/bootstrap", (req, res) => {
  const requestedApiKey = (req.body as { apiKey?: unknown } | undefined)?.apiKey;

  if (requestedApiKey !== undefined && typeof requestedApiKey !== "string") {
    return res.status(400).json({
      success: false,
      error: "INVALID_API_KEY",
      message: "apiKey must be a string when provided.",
    });
  }

  const hasCredential = Boolean(config.apiKey || config.apiKeyHash);

  if (!config.allowWebBootstrap && !hasCredential) {
    return res.status(403).json({
      success: false,
      error: "WEB_BOOTSTRAP_DISABLED",
      message: "First-run web setup is disabled for this gateway.",
    });
  }

  if (config.nodeEnv === "production" && !requestHasSameOrigin(req)) {
    return res.status(403).json({
      success: false,
      error: "INVALID_SETUP_ORIGIN",
      message: "First-run setup must come from the Wago dashboard origin.",
    });
  }

  const result = bootstrapApiKey(requestedApiKey);

  if (!result.success) {
    return res.status(result.error === "INVALID_API_KEY" ? 400 : 409).json(result);
  }

  const session = createBrowserSession();
  setBrowserSessionCookie(res, session.token);

  void recordActivity({
    level: "success",
    category: "security",
    code: result.recovered ? "gateway.credentials.recovered" : "gateway.initialized",
    title: result.recovered ? "Gateway access restored" : "Gateway initialized",
    description: result.recovered
      ? "Gateway access was restored and a new browser session was created."
      : "Gateway credentials were created and the dashboard received a separate browser session.",
  });

  return res.status(result.recovered ? 200 : 201).json({
    success: true,
    appId: result.appId,
    apiKey: result.apiKey,
    recovered: result.recovered,
    sessionExpiresAt: new Date(session.expiresAt).toISOString(),
    message: result.recovered
      ? "Gateway credentials verified. A new browser session was created."
      : "Gateway credentials generated. Save the API key, then continue with WhatsApp pairing.",
  });
});

appRouter.post("/session", (req, res) => {
  if (config.nodeEnv === "production" && !requestHasSameOrigin(req)) {
    return res.status(403).json({
      success: false,
      error: "INVALID_SESSION_ORIGIN",
      message: "Browser sign-in must come from the Wago dashboard origin.",
    });
  }

  const apiKey = (req.body as { apiKey?: unknown } | undefined)?.apiKey;

  if (typeof apiKey !== "string" || !apiKey.trim()) {
    return res.status(400).json({
      success: false,
      error: "INVALID_API_KEY",
      message: "apiKey must be a non-empty string.",
    });
  }

  if (!config.apiKey && !config.apiKeyHash) {
    return res.status(409).json({
      success: false,
      error: "GATEWAY_NOT_INITIALIZED",
      message: "Initialize the gateway before creating a browser session.",
    });
  }

  if (!isApiKeyValid(apiKey.trim())) {
    return res.status(401).json({
      success: false,
      error: "UNAUTHORIZED",
      message: "Invalid API key",
    });
  }

  const session = createBrowserSession();
  setBrowserSessionCookie(res, session.token);

  void recordActivity({
    level: "success",
    category: "security",
    code: "gateway.browser_session.created",
    title: "Browser session created",
    description: "The dashboard authenticated with the API key and received a separate browser session.",
  });

  return res.json({
    success: true,
    authenticated: true,
    expiresAt: new Date(session.expiresAt).toISOString(),
    message: "Browser session created.",
  });
});

appRouter.post("/session/logout", (req, res) => {
  const token = getBrowserSessionToken(req);

  if (token) {
    revokeBrowserSession(token);
  }

  clearBrowserSessionCookie(res);

  void recordActivity({
    level: "info",
    category: "security",
    code: "gateway.browser_session.revoked",
    title: "Browser session ended",
    description: "The current dashboard browser session was revoked.",
  });

  return res.json({
    success: true,
    authenticated: false,
    message: "Browser session ended.",
  });
});
