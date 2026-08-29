import type { Request } from "express";
import { afterEach, describe, expect, it } from "vitest";
import { config } from "../../config/index.js";
import { requestHasSameOrigin } from "./origin.js";

const originalNodeEnv = config.nodeEnv;

function requestWithOrigin(origin: string, host: string): Request {
  return {
    header(name: string) {
      if (name.toLowerCase() === "origin") return origin;
      if (name.toLowerCase() === "host") return host;
      return undefined;
    },
  } as unknown as Request;
}

afterEach(() => {
  config.nodeEnv = originalNodeEnv;
});

describe("same-origin guard", () => {
  it("allows HTTP loopback origins in production but still requires HTTPS for non-loopback hosts", () => {
    config.nodeEnv = "production";

    expect(requestHasSameOrigin(requestWithOrigin("http://127.0.0.1:3000", "127.0.0.1:3000"))).toBe(true);
    expect(requestHasSameOrigin(requestWithOrigin("http://localhost:3000", "localhost:3000"))).toBe(true);
    expect(requestHasSameOrigin(requestWithOrigin("http://[::1]:3000", "[::1]:3000"))).toBe(true);
    expect(requestHasSameOrigin(requestWithOrigin("http://wago.example.com", "wago.example.com"))).toBe(false);
    expect(requestHasSameOrigin(requestWithOrigin("https://wago.example.com", "wago.example.com"))).toBe(true);
  });
});
