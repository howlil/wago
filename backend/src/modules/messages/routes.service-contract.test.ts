import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetAccessStateForTest } from "../access/api-key.js";
import { createMessageRouter } from "./routes.js";

vi.mock("../activity/store.js", () => ({ recordActivity: vi.fn() }));

const messageService = {
  send: vi.fn(),
  findStatus: vi.fn(),
  findDiagnostic: vi.fn(),
};

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/messages", createMessageRouter(messageService));
  return app;
}

describe("message route application boundary", () => {
  beforeEach(() => {
    resetAccessStateForTest({ apiKey: "contract-key", apiKeySource: "env" });
    messageService.send.mockReset();
    messageService.findStatus.mockReset();
    messageService.findDiagnostic.mockReset();
  });

  it("delegates send orchestration to the injected message application service", async () => {
    messageService.send.mockResolvedValue({ messageId: "m-1", status: "pending" });

    const response = await request(makeApp())
      .post("/messages/send")
      .set("Authorization", "Bearer contract-key")
      .set("Idempotency-Key", "idem-1")
      .send({ to: "6281234567890", text: "Hello" });

    expect(response.status).toBe(202);
    expect(messageService.send).toHaveBeenCalledWith({
      to: "6281234567890",
      text: "Hello",
      idempotencyKey: "idem-1",
    });
  });

  it("delegates status lookup to the injected message application service", async () => {
    messageService.findStatus.mockReturnValue({
      id: "m-1",
      to: "6281234567890@s.whatsapp.net",
      status: "accepted",
      createdAt: "2026-08-10T16:59:59.000Z",
      updatedAt: "2026-08-10T17:00:00.000Z",
    });

    const response = await request(makeApp()).get("/messages/m-1/status").set("Authorization", "Bearer contract-key");

    expect(response.status).toBe(200);
    expect(messageService.findStatus).toHaveBeenCalledWith("m-1");
  });

  it("returns the sanitized end-to-end diagnostic snapshot", async () => {
    messageService.findDiagnostic.mockReturnValue({
      id: "m-1",
      status: "accepted",
      createdAt: "2026-08-10T16:59:59.000Z",
      updatedAt: "2026-08-10T17:00:00.000Z",
      acceptedAt: "2026-08-10T17:00:00.000Z",
      webhook: {
        id: "delivery-1",
        event: "message.accepted",
        status: "delivered",
        attemptCount: 1,
        redeliveryCount: 0,
        lastStatusCode: 200,
        lastErrorCode: null,
        createdAt: "2026-08-10T17:00:00.000Z",
        lastAttemptAt: "2026-08-10T17:00:01.000Z",
        deliveredAt: "2026-08-10T17:00:01.000Z",
      },
    });

    const response = await request(makeApp()).get("/messages/m-1").set("Authorization", "Bearer contract-key");

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty("to");
    expect(response.body.webhook.status).toBe("delivered");
    expect(messageService.findDiagnostic).toHaveBeenCalledWith("m-1");
  });
});
