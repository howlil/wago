import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetAccessStateForTest } from "../access/api-key.js";
import { createMessageRouter } from "./routes.js";

const service = {
  send: vi.fn(),
  findStatus: vi.fn(),
};

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/messages", createMessageRouter(service));
  return app;
}

describe("message router dependency injection", () => {
  beforeEach(() => {
    resetAccessStateForTest({ apiKey: "contract-key", apiKeySource: "env" });
    service.send.mockReset();
    service.findStatus.mockReset();
  });

  it("uses the injected service for outbound sends", async () => {
    service.send.mockResolvedValue({ messageId: "m-1", status: "pending" });

    const response = await request(makeApp())
      .post("/messages/send")
      .set("Authorization", "Bearer contract-key")
      .send({ to: "6281234567890", text: "Hello" });

    expect(response.status).toBe(202);
    expect(service.send).toHaveBeenCalledWith({
      to: "6281234567890",
      text: "Hello",
      idempotencyKey: undefined,
    });
  });
});
