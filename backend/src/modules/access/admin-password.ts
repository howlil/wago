import { createHash, timingSafeEqual } from "node:crypto";
import { config } from "../../config/index.js";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function isAdminPasswordConfigured(): boolean {
  return Boolean(config.adminPassword);
}

export function isAdminPasswordValid(candidate: string): boolean {
  const expected = config.adminPassword;
  if (!expected || !candidate) return false;
  return timingSafeEqual(digest(candidate), digest(expected));
}
