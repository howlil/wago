import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "./app.js";
import { resetBrowserSessionsForTest } from "./auth/browser-session-store.js";
import { config, hashApiKey } from "./config/index.js";

const pairingCandidate = `wa_${"a".repeat(64)}`;

function cookieFrom(response: request.Response): string {
  const header = response.headers["set-cookie"]?.[0];
  if (!header) {
    throw new Error("expected Set-Cookie header");
  }
  return header.split(";", 1)[0];
}

describe("browser session authentication", () => {
  beforeEach(() => {
    config.allowWebBootstrap = true;
    config.apiKey = null;
    config.apiKeyHash = null;
    config.apiKeySource = "unset";
    config.nodeEnv = "test";
    config.requestLogging = false;
    resetBrowserSessionsForTest();
  });

  it("bootstraps with a browser session cookie instead of placing the API key in the cookie", async () => {
    const bootstrap = await request(app).post("/app/bootstrap").send({ apiKey: pairingCandidate });

    expect(bootstrap.status).toBe(201);
    expect(bootstrap.body.apiKey).toBe(pairingCandidate);
    const cookie = cookieFrom(bootstrap);
    expect(cookie).toContain(`${config.authCookieName}=`);
    expect(cookie).not.toContain(pairingCandidate);

    const protectedResponse = await request(app).get("/recipients").set("Cookie", cookie);
    expect(protectedResponse.status).toBe(200);

    const rawKeyCookieResponse = await request(app)
      .get("/recipients")
      .set("Cookie", `${config.authCookieName}=${pairingCandidate}`);
    expect(rawKeyCookieResponse.status).toBe(401);
  });

  it("exchanges an existing API key for a browser session without changing Bearer authentication", async () => {
    config.apiKeyHash = hashApiKey("existing-key");
    config.apiKeySource = "generated";
    config.allowWebBootstrap = false;

    const login = await request(app).post("/app/session").send({ apiKey: "existing-key" });
    expect(login.status).toBe(200);
    const cookie = cookieFrom(login);
    expect(cookie).not.toContain("existing-key");

    expect((await request(app).get("/recipients").set("Cookie", cookie)).status).toBe(200);
    expect((await request(app).get("/recipients").set("Authorization", "Bearer existing-key")).status).toBe(200);
  });

  it("rejects an invalid API key without issuing a browser session", async () => {
    config.apiKeyHash = hashApiKey("existing-key");
    config.apiKeySource = "generated";
    config.allowWebBootstrap = false;

    const response = await request(app).post("/app/session").send({ apiKey: "wrong-key" });
    expect(response.status).toBe(401);
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("revokes the browser session on logout while leaving the API key valid", async () => {
    config.apiKeyHash = hashApiKey("existing-key");
    config.apiKeySource = "generated";
    config.allowWebBootstrap = false;

    const login = await request(app).post("/app/session").send({ apiKey: "existing-key" });
    const cookie = cookieFrom(login);

    const logout = await request(app).post("/app/session/logout").set("Cookie", cookie);
    expect(logout.status).toBe(200);
    expect(logout.headers["set-cookie"]?.[0]).toContain(`${config.authCookieName}=;`);

    expect((await request(app).get("/recipients").set("Cookie", cookie)).status).toBe(401);
    expect((await request(app).get("/recipients").set("Authorization", "Bearer existing-key")).status).toBe(200);
  });
});
