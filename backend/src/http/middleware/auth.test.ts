import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "../../config/index.js";
import { resetAccessStateForTest } from "../../modules/access/api-key.js";
import { createBrowserSession, resetBrowserSessionsForTest } from "../../modules/access/browser-session-store.js";
import { getBrowserSessionToken, requestHasValidBrowserSession, requireAuthenticatedRequest } from "./auth.js";

function requestWithCookie(cookie: string): Request {
  return {
    header: (name: string) => (name.toLowerCase() === "cookie" ? cookie : undefined),
  } as Request;
}

describe("auth middleware", () => {
  beforeEach(() => {
    resetAccessStateForTest();
    resetBrowserSessionsForTest();
  });

  it("treats malformed browser session cookie values as unauthenticated", () => {
    const req = requestWithCookie(`${config.authCookieName}=%E0%A4%A`);

    expect(() => getBrowserSessionToken(req)).not.toThrow();
    expect(getBrowserSessionToken(req)).toBeNull();
    expect(requestHasValidBrowserSession(req)).toBe(false);
  });

  it("allows a valid browser session before a machine API key exists", () => {
    const session = createBrowserSession();
    const req = requestWithCookie(`${config.authCookieName}=${session.token}`);
    const status = vi.fn();
    const json = vi.fn();
    const res = { status: status.mockReturnValue({ json }), json } as unknown as Response;
    const next = vi.fn() as NextFunction;

    requireAuthenticatedRequest(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
  });
});
