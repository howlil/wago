import pino from "pino";
import { config } from "../config/index.js";

const sensitiveFieldNames = new Set([
  "apiKey",
  "authorization",
  "cookie",
  "qr",
  "message",
  "text",
  "authDirectory",
  "authPath",
  "dataDirectory",
  "settingsFile",
  "password",
  "token",
]);

export const logger = pino({
  enabled: config.nodeEnv !== "test" || process.env.ENABLE_TEST_LOGS === "true",
  level: config.logLevel,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "headers.authorization",
      "headers.cookie",
      "apiKey",
      "cookie",
      "authorization",
      "qr",
      "text",
      "message",
      "authDirectory",
      "authPath",
      "dataDirectory",
      "settingsFile",
    ],
    censor: "[REDACTED]",
  },
});

export const baileysLogger = pino({
  enabled: false,
});

export function maskIdentifier(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const [localPart, domain] = value.split("@");
  const digits = localPart.replace(/\D/g, "");

  if (digits.length >= 8) {
    return `${digits.slice(0, 5)}***${digits.slice(-3)}${domain ? `@${domain}` : ""}`;
  }

  if (localPart.length <= 4) {
    return `${localPart.slice(0, 1)}***${domain ? `@${domain}` : ""}`;
  }

  return `${localPart.slice(0, 2)}***${localPart.slice(-2)}${domain ? `@${domain}` : ""}`;
}

export function redactLogFields<T>(input: T): T {
  if (!input || typeof input !== "object") {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => redactLogFields(item)) as T;
  }

  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (sensitiveFieldNames.has(key)) {
      output[key] = "[REDACTED]";
      continue;
    }

    if (key.toLowerCase().includes("jid") || key.toLowerCase().includes("phone")) {
      output[key] = typeof value === "string" ? maskIdentifier(value) : value;
      continue;
    }

    output[key] = redactLogFields(value);
  }

  return output as T;
}
