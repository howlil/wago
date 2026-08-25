import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../app.js";
import { config } from "../../config/index.js";
import { getAccessSnapshot, hashApiKey, isApiKeyValid, resetAccessStateForTest } from "./api-key.js";
import { resetBrowserSessionsForTest } from "./browser-session-store.js";

const pairingCandidate = `wa_${"a".repeat(64)}`;
const adminPassword = "correct-horse-battery-staple";

type ResponseWithHeaders = { headers: Record<string, string | string[] | undefined> };

function cookieFrom(response: ResponseWithHeaders): string {
  const raw = response.headers["set-cookie"];
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (!header) throw new Error("expected Set-Cookie header");
  return header.split(";", 1)[0];
}

describe("browser session authentication", () => {
  beforeEach(() => {
    resetAccessStateForTest();
    resetBrowserSessionsForTest();
    config.adminPassword = adminPassword;
    config.nodeEnv = "test";
    config.requestLogging = false;
  });

  it("bootstraps with a browser session cookie instead of placing the API key in the cookie", async () => {
    const bootstrap = await request(app).post("/app/bootstrap").send({ apiKey: pairingCandidate });
    expect(bootstrap.status).toBe(201);
    expect(bootstrap.body.apiKey).toBe(pairingCandidate);
    const cookie = cookieFrom(bootstrap);
    expect(cookie).toContain(`${config.authCookieName}=`);
    expect(cookie).not.toContain(pairingCandidate);
    expect(getAccessSnapshot().apiKeySource).toBe("generated");
    expect(isApiKeyValid(pairingCandidate)).toBe(true);
    expect((await request(app).get("/recipients").set("Cookie", cookie)).status).toBe(200);
    expect((await request(app).get("/recipients").set("Cookie", `${config.authCookieName}=${pairingCandidate}`)).status).toBe(401);
  });

  it("uses the admin password for a browser session without changing Bearer authentication", async () => {
    resetAccessStateForTest({ apiKeyHash: hashApiKey("existing-key"), apiKeySource: "generated" });
    const login = await request(app).post("/app/session").send({ password: adminPassword });
    expect(login.status).toBe(200);
    const cookie = cookieFrom(login);
    expect(cookie).not.toContain(adminPassword);
    expect((await request(app).get("/recipients").set("Cookie", cookie)).status).toBe(200);
    expect((await request(app).get("/recipients").set("Authorization", "Bearer existing-key")).status).toBe(200);
  });

  it("rejects an invalid admin password without issuing a browser session", async () => {
    const response = await request(app).post("/app/session").send({ password: "wrong-password" });
    expect(response.status).toBe(401);
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("revokes the browser session on logout while leaving the API key valid", async () => {
    resetAccessStateForTest({ apiKeyHash: hashApiKey("existing-key"), apiKeySource: "generated" });
    const login = await request(app).post("/app/session").send({ password: adminPassword });
    const cookie = cookieFrom(login);
    const logout = await request(app).post("/app/session/logout").set("Cookie", cookie);
    expect(logout.status).toBe(200);
    expect(logout.headers["set-cookie"]?.[0]).toContain(`${config.authCookieName}=;`);
    expect((await request(app).get("/recipients").set("Cookie", cookie)).status).toBe(401);
    expect((await request(app).get("/recipients").set("Authorization", "Bearer existing-key")).status).toBe(200);
  });
});
