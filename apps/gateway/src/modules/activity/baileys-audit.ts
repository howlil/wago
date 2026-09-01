import { maskIdentifier } from "../../infrastructure/logger.js";
import type { AuditInput, AuditMetadata } from "./audit-event.js";
import { recordActivity } from "./store.js";

export type BaileysAuditInput = Omit<AuditInput, "source" | "metadata"> & {
  metadata?: Record<string, unknown>;
};

const SENSITIVE_KEY_PARTS = [
  "qr",
  "key",
  "secret",
  "token",
  "cookie",
  "authorization",
  "credential",
  "password",
  "message",
  "text",
  "payload",
] as const;

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}

function isIdentifierKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return normalized.includes("jid") || normalized.includes("phone");
}

function isSafePrimitive(value: unknown): value is string | number | boolean | null {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

export function sanitizeBaileysMetadata(metadata: Record<string, unknown>): AuditMetadata {
  const sanitized: AuditMetadata = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key) || !isSafePrimitive(value)) {
      continue;
    }

    if (isIdentifierKey(key)) {
      if (typeof value === "string") {
        sanitized[key] = maskIdentifier(value);
      }
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

export async function recordBaileysAudit(input: BaileysAuditInput) {
  return recordActivity({
    ...input,
    source: "baileys",
    metadata: input.metadata ? sanitizeBaileysMetadata(input.metadata) : undefined,
  });
}
