import { resolve } from "node:path";
import { dataDirectory, nodeEnv } from "./runtime-paths.js";

function envFlag(name: string, fallback = false): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) {
    return fallback;
  }

  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function optionalSecret(name: string, minimumBytes: number): string | null {
  const value = process.env[name]?.trim();
  if (!value) return null;
  if (Buffer.byteLength(value, "utf8") < minimumBytes) {
    throw new Error(`${name} must be at least ${minimumBytes} bytes long`);
  }
  return value;
}

const setupToken = optionalSecret("SETUP_TOKEN", 32);
const adminPassword = optionalSecret("WAGO_ADMIN_PASSWORD", 12);

export type RuntimeConfig = {
  deploymentApiKey: string | null;
  setupToken: string | null;
  adminPassword: string | null;
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
  adminPassword,
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
