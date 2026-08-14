import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceMock = vi.hoisted(() => ({
  messageService: { send: vi.fn(), findStatus: vi.fn() },
}));

const whatsappMock = vi.hoisted(() => ({
  sendTextMessage: vi.fn(),
  getMessageStatus: vi.fn(),
}));

vi.mock("./message.service.js", () => serviceMock);
vi.mock("../whatsapp/index.js", () => whatsappMock);
vi.mock("../activity/store.js", () => ({ recordActivity: vi.fn() }));

import { resetAccessStateForTest } from "../access/api-key.js";
import { messageRouter } from "./routes.js";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/messages", messageRouter);
  return app;
}

describe("message route application boundary", () => {
  beforeEach(() => {
    resetAccessStateForTest({ apiKey: "contract-key", apiKeySource: "env" });

    serviceMock.messageService.send.mockReset();
    serviceMock.messageService.findStatus.mockReset();
    whatsappMock.sendTextMessage.mockReset();
    whatsappMock.getMessageStatus.mockReset();
  });

  it("delegates send orchestration to the message application service", async () => {
    serviceMock.messageService.send.mockResolvedValue({ messageId: "m-1", status: "pending" });
    whatsappMock.sendTextMessage.mockResolvedValue({ messageId: "legacy", status: "pending" });

    const response = await request(makeApp())
      .post("/messages/send")
      .set("Authorization", "Bearer contract-key")
      .set("Idempotency-Key", "idem-1")
      .send({ to: "6281234567890", text: "Hello" });

    expect(response.status).toBe(202);
    expect(serviceMock.messageService.send).toHaveBeenCalledWith({
      to: "6281234567890",
      text: "Hello",
      idempotencyKey: "idem-1",
    });
    expect(whatsappMock.sendTextMessage).not.toHaveBeenCalled();
  });

  it("delegates status lookup to the message application service", async () => {
    serviceMock.messageService.findStatus.mockReturnValue({
      id: "m-1",
      to: "6281234567890@s.whatsapp.net",
      status: "accepted",
      updatedAt: "2026-08-10T17:00:00.000Z",
    });
    whatsappMock.getMessageStatus.mockReturnValue(undefined);

    const response = await request(makeApp()).get("/messages/m-1/status").set("Authorization", "Bearer contract-key");

    expect(response.status).toBe(200);
    expect(serviceMock.messageService.findStatus).toHaveBeenCalledWith("m-1");
    expect(whatsappMock.getMessageStatus).not.toHaveBeenCalled();
  });
});
