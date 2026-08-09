import { Router } from "express";
import { bootstrapApiKey, config } from "../config/index.js";
import { requestHasValidApiKey } from "../middleware/auth.js";

export const appRouter = Router();

appRouter.get("/info", (req, res) => {
  res.json({
    success: true,
    appId: config.appId,
    apiKeyRequired: true,
    apiKeyConfigured: Boolean(config.apiKey || config.apiKeyHash),
    apiKeySource: config.apiKeySource,
    authenticated: requestHasValidApiKey(req),
    setupRequired: !config.apiKey && !config.apiKeyHash,
  });
});

appRouter.post("/bootstrap", (req, res) => {
  if (config.apiKey || config.apiKeyHash) {
    return res.status(409).json({
      success: false,
      error: "APP_ALREADY_INITIALIZED",
      message: "This app is already initialized. Use the existing API key or auth cookie.",
    });
  }

  if (!config.allowWebBootstrap) {
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

  const result = bootstrapApiKey();

  if (!result.success) {
    return res.status(409).json({
      success: false,
      error: "APP_ALREADY_INITIALIZED",
      message: result.message,
    });
  }

  res.cookie(config.authCookieName, result.apiKey, {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 180,
    sameSite: "lax",
    secure: config.authCookieSecure,
  });

  return res.status(201).json({
    success: true,
    appId: result.appId,
    apiKey: result.apiKey,
    message: "Gateway credentials generated. Copy the API key and continue with WhatsApp pairing.",
  });
});
