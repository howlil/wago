import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "./app.js";
import { config } from "./config/index.js";
import { hashApiKey, resetAccessStateForTest } from "./modules/access/api-key.js";
import { resetBrowserSessionsForTest } from "./modules/access/browser-session-store.js";

const oldApiKey = `wa_${"a".repeat(64)}`;
type ResponseWithHeaders = { headers: Record<string, string | string[] | undefined> };

function cookieFrom(response: ResponseWithHeaders): string {
  const raw = response.headers["set-cookie"];
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (!header) throw new Error("expected Set-Cookie header");
  return header.split(";", 1)[0];
}

describe("credential rotation endpoint", () => {
  beforeEach(() => {
    resetAccessStateForTest({ apiKeyHash: hashApiKey(oldApiKey), apiKeySource: "generated" });
    resetBrowserSessionsForTest();
    config.setupToken = null;
    config.nodeEnv = "test";
    config.requestLogging = false;
  });

  it("rotates the Bearer key, preserves the initiating session, and revokes other dashboard sessions", async () => {
    expect((await request(app).post("/app/api-key/rotate").set("Authorization", `Bearer ${oldApiKey}`)).status).toBe(
      401,
    );

    const loginA = await request(app).post("/app/session").send({ apiKey: oldApiKey });
    const loginB = await request(app).post("/app/session").send({ apiKey: oldApiKey });
    const cookieA = cookieFrom(loginA);
    const cookieB = cookieFrom(loginB);

    const rotate = await request(app).post("/app/api-key/rotate").set("Cookie", cookieA);
    expect(rotate.status).toBe(200);
    expect(rotate.body.apiKey).toMatch(/^wa_[A-Za-z0-9_-]{43,64}$/);
    expect(rotate.body.apiKey).not.toBe(oldApiKey);
    expect(rotate.body.revokedBrowserSessions).toBe(1);

    expect((await request(app).get("/recipients").set("Authorization", `Bearer ${oldApiKey}`)).status).toBe(401);
    expect(
      (
        await request(app)
          .get("/recipients")
          .set("Authorization", `Bearer ${rotate.body.apiKey as string}`)
      ).status,
    ).toBe(200);
    expect((await request(app).get("/recipients").set("Cookie", cookieA)).status).toBe(200);
    expect((await request(app).get("/recipients").set("Cookie", cookieB)).status).toBe(401);
  });

  it("revokes every dashboard session on logout-all without changing the machine key", async () => {
    const loginA = await request(app).post("/app/session").send({ apiKey: oldApiKey });
    const loginB = await request(app).post("/app/session").send({ apiKey: oldApiKey });
    const cookieA = cookieFrom(loginA);
    const cookieB = cookieFrom(loginB);

    const logoutAll = await request(app).post("/app/session/logout-all").set("Cookie", cookieA);
    expect(logoutAll.status).toBe(200);
    expect(logoutAll.body.revokedBrowserSessions).toBe(2);
    expect((await request(app).get("/recipients").set("Cookie", cookieA)).status).toBe(401);
    expect((await request(app).get("/recipients").set("Cookie", cookieB)).status).toBe(401);
    expect((await request(app).get("/recipients").set("Authorization", `Bearer ${oldApiKey}`)).status).toBe(200);
  });

  it("does not allow the dashboard to rotate an environment-managed credential", async () => {
    resetAccessStateForTest({ apiKey: "deployment-owned-key", apiKeySource: "env" });
    const login = await request(app).post("/app/session").send({ apiKey: "deployment-owned-key" });
    const response = await request(app).post("/app/api-key/rotate").set("Cookie", cookieFrom(login));
    expect(response.status).toBe(409);
    expect(response.body.error).toBe("API_KEY_MANAGED_BY_ENV");
  });
});
