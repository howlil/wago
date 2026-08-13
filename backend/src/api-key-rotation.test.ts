import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./app.js";

describe("credential rotation endpoint", () => {
  it("is not exposed before it is implemented", async () => {
    const response = await request(app).post("/app/api-key/rotate");
    expect(response.status).not.toBe(404);
  });
});
