import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getDatabase } from "../../infrastructure/database.js";
import { createAppSettingsStore } from "./app-settings-store.js";

const minimumPasswordBytes = 12;
const maximumPasswordBytes = 1024;
const passwordHashBytes = 32;
const passwordHashScheme = "scrypt";

export type CreateAdminPasswordResult =
  | { success: true }
  | { success: false; error: "ADMIN_ALREADY_CONFIGURED" | "INVALID_ADMIN_PASSWORD"; message: string };

const settingsStore = createAppSettingsStore(getDatabase());

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, passwordHashBytes);
  return `${passwordHashScheme}$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
}

function verifyPassword(password: string, encodedHash: string): boolean {
  const [scheme, encodedSalt, encodedDerivedKey, ...rest] = encodedHash.split("$");
  if (scheme !== passwordHashScheme || !encodedSalt || !encodedDerivedKey || rest.length > 0) return false;

  try {
    const salt = Buffer.from(encodedSalt, "base64url");
    const expected = Buffer.from(encodedDerivedKey, "base64url");
    if (expected.length !== passwordHashBytes) return false;
    const actual = scryptSync(password, salt, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function validatePassword(password: string): string | null {
  const byteLength = Buffer.byteLength(password, "utf8");
  if (byteLength < minimumPasswordBytes) {
    return `Admin password must be at least ${minimumPasswordBytes} bytes long.`;
  }
  if (byteLength > maximumPasswordBytes) {
    return `Admin password must be at most ${maximumPasswordBytes} bytes long.`;
  }
  return null;
}

export function isAdminPasswordConfigured(): boolean {
  return Boolean(settingsStore.getAdminPasswordHash());
}

export function createAdminPassword(password: string): CreateAdminPasswordResult {
  if (isAdminPasswordConfigured()) {
    return {
      success: false,
      error: "ADMIN_ALREADY_CONFIGURED",
      message: "The admin account is already configured. Sign in with the existing admin password.",
    };
  }

  const validationError = validatePassword(password);
  if (validationError) {
    return { success: false, error: "INVALID_ADMIN_PASSWORD", message: validationError };
  }

  settingsStore.setAdminPasswordHash(hashPassword(password));
  return { success: true };
}

export function isAdminPasswordValid(candidate: string): boolean {
  if (!candidate || Buffer.byteLength(candidate, "utf8") > maximumPasswordBytes) return false;
  const encodedHash = settingsStore.getAdminPasswordHash();
  return encodedHash ? verifyPassword(candidate, encodedHash) : false;
}

export function resetAdminPasswordForTest(password: string | null = null): void {
  settingsStore.setAdminPasswordHash(password ? hashPassword(password) : null);
}
