import { Router } from "express";
import { bootstrapApiKey, config } from "../config.js";
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
    setupRequired: !config.apiKey
  });
});

appRouter.post("/bootstrap", (_req, res) => {
  if (!config.allowWebBootstrap) {
    return res.status(403).json({
      success: false,
      error: "WEB_BOOTSTRAP_DISABLED",
      message: "Web bootstrap is disabled. Set API_KEY or enable ALLOW_WEB_BOOTSTRAP for initial setup."
    });
  }

  const result = bootstrapApiKey();

  if (!result.success) {
    return res.status(409).json({
      success: false,
      error: "APP_ALREADY_INITIALIZED",
      message: result.message
    });
  }

  res.cookie(config.authCookieName, result.apiKey, {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 180,
    sameSite: "lax",
    secure: config.authCookieSecure
  });

  return res.status(201).json({
    success: true,
    appId: result.appId,
    apiKey: result.apiKey,
    message: "App initialized. The API key was generated and saved in this browser."
  });
});
