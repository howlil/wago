import { resolve } from "node:path";
import { dataDirectory, nodeEnv } from "./runtime-paths.js";

export type RuntimeConfig = {
  authCookieName: string;
  authCookieSecure: boolean;
  browserSessionMaxAgeMs: number;
  bodyLimit: string;
  authDirectory: string;
  dataDirectory: string;
  frontendDirectory: string | null;
  nodeEnv: string;
  requestLogging: boolean;
  logLevel: string;
};

export const config: RuntimeConfig = {
  authCookieName: "wago_session",
  authCookieSecure: nodeEnv === "production",
  browserSessionMaxAgeMs: 1000 * 60 * 60 * 24 * 30,
  bodyLimit: "32kb",
  authDirectory: resolve(dataDirectory, "auth"),
  dataDirectory,
  frontendDirectory: nodeEnv === "production" ? "/app/public" : null,
  nodeEnv,
  requestLogging: true,
  logLevel: nodeEnv === "production" ? "info" : "debug",
};
