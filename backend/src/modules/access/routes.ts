import { type Response, Router } from "express";
import { config } from "../../config/index.js";
import {
  getBrowserSessionToken,
  requestHasValidBrowserSession,
  requestIsAuthenticated,
} from "../../http/middleware/auth.js";
import { requestHasSameOrigin } from "../../http/middleware/origin.js";
import { recordActivity } from "../activity/store.js";
import { isAdminPasswordValid } from "./admin-password.js";
import {
  bootstrapApiKey,
  getAccessSnapshot,
  isApiKeyValid,
  isSetupCodeValid,
  rotateGeneratedApiKey,
} from "./api-key.js";
import {
  createBrowserSession,
  revokeAllBrowserSessions,
  revokeBrowserSession,
  revokeOtherBrowserSessions,
} from "./browser-session-store.js";

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
  const dashboardAuthMode = config.adminPassword ? "password" : access.apiKeyConfigured ? "legacy_api_key" : "unconfigured";

  if (req.header("cookie")?.includes(`${config.legacyAuthCookieName}=`)) clearLegacyApiKeyCookie(res);

  res.json({
    success: true,
    appId: access.appId,
    apiKeyRequired: true,
    apiKeyConfigured: access.apiKeyConfigured,
    apiKeySource: access.apiKeySource,
    authenticated: requestIsAuthenticated(req),
    adminPasswordConfigured: Boolean(config.adminPassword),
    dashboardAuthMode,
    credentialSetupRequired: access.credentialSetupRequired,
    setupRequired: access.credentialSetupRequired,
    setupCodeRequired: access.setupCodeRequired,
    setupTokenRequired: access.setupCodeRequired,
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

  if (config.nodeEnv === "production" && !requestHasSameOrigin(req)) {
    return res.status(403).json({
      success: false,
      error: "INVALID_SETUP_ORIGIN",
      message: "First-run setup must come from the Wago dashboard origin.",
    });
  }

  if (config.nodeEnv === "production" && !access.apiKeyConfigured && !requestHasValidBrowserSession(req)) {
    if (access.setupCodeRequired) {
      const setupCode = req.header("x-wago-setup-code") ?? req.header("x-wago-setup-token");
      if (!setupCode) {
        return res.status(403).json({
          success: false,
          error: "SETUP_CODE_REQUIRED",
          message: "Legacy first-run setup requires the configured SETUP_TOKEN.",
        });
      }
      if (!isSetupCodeValid(setupCode)) {
        return res.status(403).json({ success: false, error: "INVALID_SETUP_CODE", message: "Invalid setup code." });
      }
    } else {
      return res.status(403).json({
        success: false,
        error: "ADMIN_PASSWORD_REQUIRED",
        message: "Configure WAGO_ADMIN_PASSWORD and sign in to the dashboard before first pairing.",
      });
    }
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

appRouter.post("/session", (req, res) => {
  if (config.nodeEnv === "production" && !requestHasSameOrigin(req)) {
    return res.status(403).json({
      success: false,
      error: "INVALID_SESSION_ORIGIN",
      message: "Browser sign-in must come from the Wago dashboard origin.",
    });
  }

  const body = req.body as { password?: unknown; apiKey?: unknown } | undefined;
  const access = getAccessSnapshot();
  let authenticationMethod: "admin_password" | "legacy_api_key";

  if (config.adminPassword) {
    const password = body?.password;
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
    authenticationMethod = "admin_password";
  } else {
    if (!access.apiKeyConfigured) {
      return res.status(503).json({
        success: false,
        error: "ADMIN_PASSWORD_REQUIRED",
        message: "Configure WAGO_ADMIN_PASSWORD in the deployment before signing in to a fresh gateway.",
      });
    }

    const apiKey = body?.apiKey;
    if (typeof apiKey !== "string" || !apiKey.trim()) {
      return res.status(400).json({
        success: false,
        error: "INVALID_API_KEY",
        message: "This upgraded gateway has no admin password yet; provide the existing API key once for legacy sign-in.",
      });
    }
    if (!isApiKeyValid(apiKey.trim())) {
      return res.status(401).json({ success: false, error: "UNAUTHORIZED", message: "Invalid API key" });
    }
    authenticationMethod = "legacy_api_key";
  }

  const session = createBrowserSession();
  setBrowserSessionCookie(res, session.token);
  void recordActivity({
    level: "success",
    category: "security",
    code: "gateway.browser_session.created",
    title: "Browser session created",
    description:
      authenticationMethod === "admin_password"
        ? "The dashboard authenticated with the admin password and received a browser session."
        : "The dashboard used the legacy API-key recovery path and received a browser session.",
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
