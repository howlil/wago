import { type Response, Router } from "express";
import { recordActivity } from "../activity/store.js";
import { config } from "../config/index.js";
import {
  getBrowserSessionToken,
  requestHasValidBrowserSession,
  requestIsAuthenticated,
} from "../http/middleware/auth.js";
import { requestHasSameOrigin } from "../middleware/origin.js";
import {
  bootstrapApiKey,
  getAccessSnapshot,
  isApiKeyValid,
  isSetupTokenValid,
  rotateGeneratedApiKey,
} from "../modules/access/api-key.js";
import {
  createBrowserSession,
  revokeAllBrowserSessions,
  revokeBrowserSession,
  revokeOtherBrowserSessions,
} from "../modules/access/browser-session-store.js";

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
  res.cookie(config.authCookieName, token, { ...browserCookieOptions, maxAge: config.browserSessionMaxAgeMs });
  clearLegacyApiKeyCookie(res);
}

function clearBrowserSessionCookie(res: Response): void {
  res.clearCookie(config.authCookieName, browserCookieOptions);
  clearLegacyApiKeyCookie(res);
}

appRouter.get("/info", (req, res) => {
  const access = getAccessSnapshot();
  const productionBootstrap = config.nodeEnv === "production";
  const setupTokenRequired = access.credentialSetupRequired && productionBootstrap && Boolean(config.setupToken);

  if (req.header("cookie")?.includes(`${config.legacyAuthCookieName}=`)) clearLegacyApiKeyCookie(res);

  res.json({
    success: true,
    appId: access.appId,
    apiKeyRequired: true,
    apiKeyConfigured: access.apiKeyConfigured,
    apiKeySource: access.apiKeySource,
    authenticated: requestIsAuthenticated(req),
    credentialSetupRequired: access.credentialSetupRequired,
    setupRequired: access.credentialSetupRequired,
    setupTokenRequired,
    webBootstrapEnabled: access.webBootstrapEnabled,
  });
});

appRouter.post("/bootstrap", (req, res) => {
  const requestedApiKey = (req.body as { apiKey?: unknown } | undefined)?.apiKey;
  if (requestedApiKey !== undefined && typeof requestedApiKey !== "string") {
    return res
      .status(400)
      .json({ success: false, error: "INVALID_API_KEY", message: "apiKey must be a string when provided." });
  }

  const access = getAccessSnapshot();
  if (!access.webBootstrapEnabled && !access.apiKeyConfigured) {
    return res.status(403).json({
      success: false,
      error: "WEB_BOOTSTRAP_DISABLED",
      message: "First-run web setup is disabled. Configure a SETUP_TOKEN with at least 32 bytes of entropy.",
    });
  }

  if (config.nodeEnv === "production" && !requestHasSameOrigin(req)) {
    return res.status(403).json({
      success: false,
      error: "INVALID_SETUP_ORIGIN",
      message: "First-run setup must come from the Wago dashboard origin.",
    });
  }

  if (config.nodeEnv === "production" && !access.apiKeyConfigured) {
    if (!config.setupToken) {
      return res.status(403).json({
        success: false,
        error: "WEB_BOOTSTRAP_DISABLED",
        message: "First-run web setup is disabled. Configure a SETUP_TOKEN with at least 32 bytes of entropy.",
      });
    }
    const setupToken = req.header("x-wago-setup-token");
    if (!setupToken) {
      return res.status(403).json({
        success: false,
        error: "SETUP_TOKEN_REQUIRED",
        message: "Provide the deployment setup token to initialize this gateway.",
      });
    }
    if (!isSetupTokenValid(setupToken)) {
      return res.status(403).json({ success: false, error: "INVALID_SETUP_TOKEN", message: "Invalid setup token." });
    }
  }

  const result = bootstrapApiKey(requestedApiKey);
  if (!result.success) return res.status(result.error === "INVALID_API_KEY" ? 400 : 409).json(result);

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
    return res
      .status(400)
      .json({ success: false, error: "INVALID_API_KEY", message: "apiKey must be a non-empty string." });
  }
  if (!getAccessSnapshot().apiKeyConfigured) {
    return res.status(409).json({
      success: false,
      error: "GATEWAY_NOT_INITIALIZED",
      message: "Initialize the gateway before creating a browser session.",
    });
  }
  if (!isApiKeyValid(apiKey.trim())) {
    return res.status(401).json({ success: false, error: "UNAUTHORIZED", message: "Invalid API key" });
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
