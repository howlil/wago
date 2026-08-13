import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "./app.js";
import { resetBrowserSessionsForTest } from "./auth/browser-session-store.js";
import { config, hashApiKey, resetPersistedSettingsForTest } from "./config/index.js";

const oldApiKey = `wa_${"a".repeat(64)}`;

type ResponseWithHeaders = {
  headers: Record<string, string | string[] | undefined>;
};

function cookieFrom(response: ResponseWithHeaders): string {
  const raw = response.headers["set-cookie"];
  const header = Array.isArray(raw) ? raw[0] : raw;

  if (!header) {
    throw new Error("expected Set-Cookie header");
  }

  return header.split(";", 1)[0];
}

describe("credential rotation endpoint", () => {
  beforeEach(() => {
    resetPersistedSettingsForTest();
    resetBrowserSessionsForTest();
    config.allowWebBootstrap = false;
    config.apiKey = null;
    config.apiKeyHash = hashApiKey(oldApiKey);
    config.apiKeySource = "generated";
    config.nodeEnv = "test";
    config.requestLogging = false;
  });

  it("requires the dashboard session, replaces the generated Bearer credential, and keeps that session active", async () => {
    const bearerAttempt = await request(app)
      .post("/app/api-key/rotate")
      .set("Authorization", `Bearer ${oldApiKey}`);
    expect(bearerAttempt.status).toBe(401);
    expect(bearerAttempt.body.error).toBe("BROWSER_SESSION_REQUIRED");

    const login = await request(app).post("/app/session").send({ apiKey: oldApiKey });
    expect(login.status).toBe(200);
    const cookie = cookieFrom(login);

    const rotate = await request(app).post("/app/api-key/rotate").set("Cookie", cookie);
    expect(rotate.status).toBe(200);
    expect(rotate.body).toMatchObject({ success: true });
    expect(rotate.body.apiKey).toMatch(/^wa_[A-Za-z0-9_-]{43,64}$/);
    expect(rotate.body.apiKey).not.toBe(oldApiKey);
    expect(rotate.body.generatedAt).toBeTruthy();

    expect((await request(app).get("/recipients").set("Authorization", `Bearer ${oldApiKey}`)).status).toBe(401);
    expect(
      (
        await request(app)
          .get("/recipients")
          .set("Authorization", `Bearer ${rotate.body.apiKey as string}`)
      ).status,
    ).toBe(200);
    expect((await request(app).get("/recipients").set("Cookie", cookie)).status).toBe(200);

    const info = await request(app).get("/app/info").set("Cookie", cookie);
    expect(info.status).toBe(200);
    expect(info.body.authenticated).toBe(true);
    expect(info.body.apiKeySource).toBe("generated");
    expect(info.body.apiKey).toBeUndefined();
  });

  it("does not allow the dashboard to rotate an environment-managed credential", async () => {
    config.apiKey = "deployment-owned-key";
    config.apiKeyHash = null;
    config.apiKeySource = "env";

    const login = await request(app).post("/app/session").send({ apiKey: "deployment-owned-key" });
    expect(login.status).toBe(200);
    const cookie = cookieFrom(login);

    const response = await request(app).post("/app/api-key/rotate").set("Cookie", cookie);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      error: "API_KEY_MANAGED_BY_ENV",
      message: "This API key is managed by the deployment environment and must be rotated there.",
    });
    expect(config.apiKey).toBe("deployment-owned-key");
    expect(config.apiKeyHash).toBeNull();
  });
});
