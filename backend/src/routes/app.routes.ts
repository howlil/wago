import { Router } from "express";
import { bootstrapApiKey, config } from "../config/index.js";
import { requestHasValidApiKey } from "../middleware/auth.js";

export const appRouter = Router();

appRouter.get("/info", (req, res) => {
  const credentialSetupRequired = !config.apiKey && !config.apiKeyHash;

  res.json({
    success: true,
    appId: config.appId,
    apiKeyRequired: true,
    apiKeyConfigured: !credentialSetupRequired,
    apiKeySource: config.apiKeySource,
    authenticated: requestHasValidApiKey(req),
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

  if (config.nodeEnv === "production" && req.header("origin") !== config.corsOrigin) {
    return res.status(403).json({
      success: false,
      error: "INVALID_SETUP_ORIGIN",
      message: "First-run setup must come from the configured CORS_ORIGIN.",
    });
  }

  const result = bootstrapApiKey(requestedApiKey);

  if (!result.success) {
    return res.status(result.error === "INVALID_API_KEY" ? 400 : 409).json(result);
  }

  res.cookie(config.authCookieName, result.apiKey, {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 180,
    sameSite: "lax",
    secure: config.authCookieSecure,
  });

  return res.status(result.recovered ? 200 : 201).json({
    success: true,
    appId: result.appId,
    apiKey: result.apiKey,
    recovered: result.recovered,
    message: result.recovered
      ? "Gateway credentials recovered for this browser session."
      : "Gateway credentials generated. Continue with WhatsApp pairing.",
  });
});
