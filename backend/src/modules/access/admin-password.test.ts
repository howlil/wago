import { describe, expect, it, beforeEach } from "vitest";
import { getDatabase } from "../../infrastructure/database.js";
import {
  createAdminPassword,
  isAdminPasswordConfigured,
  isAdminPasswordValid,
  resetAdminPasswordForTest,
} from "./admin-password.js";
import { resetAccessStateForTest } from "./api-key.js";

const password = "correct-horse-battery-staple";

describe("admin password", () => {
  beforeEach(() => {
    resetAccessStateForTest();
    resetAdminPasswordForTest();
  });

  it("persists a salted password hash instead of plaintext", () => {
    expect(createAdminPassword(password)).toEqual({ success: true });
    expect(isAdminPasswordConfigured()).toBe(true);
    expect(isAdminPasswordValid(password)).toBe(true);
    expect(isAdminPasswordValid("wrong-password")).toBe(false);

    const row = getDatabase()
      .prepare("SELECT admin_password_hash FROM app_settings WHERE id = 1")
      .get() as { admin_password_hash?: string | null };
    expect(row.admin_password_hash).toMatch(/^scrypt\$/);
    expect(row.admin_password_hash).not.toContain(password);
  });

  it("rejects weak passwords and refuses to overwrite an existing admin account", () => {
    expect(createAdminPassword("short")).toMatchObject({
      success: false,
      error: "INVALID_ADMIN_PASSWORD",
    });
    expect(createAdminPassword(password)).toEqual({ success: true });
    expect(createAdminPassword("another-valid-password")).toMatchObject({
      success: false,
      error: "ADMIN_ALREADY_CONFIGURED",
    });
    expect(isAdminPasswordValid(password)).toBe(true);
    expect(isAdminPasswordValid("another-valid-password")).toBe(false);
  });
});
