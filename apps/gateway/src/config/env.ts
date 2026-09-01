import { resolve } from "node:path";
import { dataDirectory, nodeEnv } from "./runtime-paths.js";

function envFlag(name: string, fallback = false): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) {
    return fallback;
  }

  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export type RuntimeConfig = {
  deploymentApiKey: string | null;
  authCookieName: string;
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
  authCookieName: "wago_session",
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
