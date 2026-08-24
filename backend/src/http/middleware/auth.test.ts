import type { Request } from "express";
import { describe, expect, it } from "vitest";
import { config } from "../../config/index.js";
import { getBrowserSessionToken, requestHasValidBrowserSession } from "./auth.js";

function requestWithCookie(cookie: string): Request {
  return {
    header: (name: string) => (name.toLowerCase() === "cookie" ? cookie : undefined),
  } as Request;
}

describe("auth middleware", () => {
  it("treats malformed browser session cookie values as unauthenticated", () => {
    const req = requestWithCookie(`${config.authCookieName}=%E0%A4%A`);

    expect(() => getBrowserSessionToken(req)).not.toThrow();
    expect(getBrowserSessionToken(req)).toBeNull();
    expect(requestHasValidBrowserSession(req)).toBe(false);
  });
});
