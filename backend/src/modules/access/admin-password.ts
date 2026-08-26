import { scryptSync, timingSafeEqual } from "node:crypto";
import { config } from "../../config/index.js";

const ADMIN_PASSWORD_SALT = "wago:admin-password:v1";

function hashPassword(value: string): Buffer {
  return scryptSync(value, ADMIN_PASSWORD_SALT, 32);
}

export function isAdminPasswordConfigured(): boolean {
  return Boolean(config.adminPassword);
}

export function isAdminPasswordValid(candidate: string): boolean {
  const expected = config.adminPassword;
  if (!expected || !candidate) return false;
  return timingSafeEqual(hashPassword(candidate), hashPassword(expected));
}
