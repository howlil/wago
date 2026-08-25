import { resolve } from "node:path";
import { dataDirectory, nodeEnv } from "./runtime-paths.js";

function envFlag(name: string, fallback = false): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) {
    return fallback;
  }

  return value === "1" || value === "true" || value === "yes" || value === "on";
}

const rawSetupToken = process.env.SETUP_TOKEN?.trim();
const setupToken = rawSetupToken && Buffer.byteLength(rawSetupToken, "utf8") >= 32 ? rawSetupToken : null;

export type RuntimeConfig = {
  deploymentApiKey: string | null;
  setupToken: string | null;
  authCookieName: string;
  legacyAuthCookieName: string;
  authCookieSecure: boolean;
  browserSessionMaxAgeMs: number;
  bodyLimit: string;
  authDirectory: string;
  dataDirectory: string;
  frontendDirectory: string | null;
  nodeEnv: string;
  requestLogging: boolean;
  trustProxy: boolean;
  defaultCountryCode: string;
  logLevel: string;
};

export const config: RuntimeConfig = {
  deploymentApiKey: process.env.API_KEY?.trim() || null,
  setupToken,
  authCookieName: "wago_session",
  legacyAuthCookieName: "wa_gateway_api_key",
  authCookieSecure: nodeEnv === "production",
  browserSessionMaxAgeMs: 1000 * 60 * 60 * 24 * 30,
  bodyLimit: "32kb",
  authDirectory: resolve(dataDirectory, "auth"),
  dataDirectory,
  frontendDirectory: nodeEnv === "production" ? "/app/public" : null,
  nodeEnv,
  requestLogging: true,
  trustProxy: envFlag("TRUST_PROXY"),
  defaultCountryCode: process.env.DEFAULT_COUNTRY_CODE?.trim() || "62",
  logLevel: nodeEnv === "production" ? "info" : "debug",
};
