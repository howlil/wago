import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApplicationError } from "./errors/application-error.js";

const whatsappMock = vi.hoisted(() => ({
  getCurrentQr: vi.fn(),
  getMessageStatus: vi.fn(),
  getWhatsAppStatus: vi.fn(),
  pairWhatsApp: vi.fn(),
  rebindWhatsApp: vi.fn(),
  sendTextMessage: vi.fn(),
}));

vi.mock("./whatsapp.js", () => whatsappMock);

import { app } from "./app.js";
import { config } from "./config/index.js";
import { resetAccessStateForTest } from "./modules/access/api-key.js";

describe("typed HTTP application error contract", () => {
  beforeEach(() => {
    resetAccessStateForTest({ apiKey: "typed-error-key", apiKeySource: "env" });
    config.nodeEnv = "test";
    config.requestLogging = false;

    whatsappMock.getCurrentQr.mockReset();
    whatsappMock.getMessageStatus.mockReset();
    whatsappMock.getWhatsAppStatus.mockReset();
    whatsappMock.pairWhatsApp.mockReset();
    whatsappMock.rebindWhatsApp.mockReset();
    whatsappMock.sendTextMessage.mockReset();
  });

  it("maps a typed duplicate-message error through the existing public contract", async () => {
    whatsappMock.sendTextMessage.mockRejectedValueOnce(
      new ApplicationError("DUPLICATE_MESSAGE", "Message already accepted"),
    );

    const response = await request(app)
      .post("/messages/send")
      .set("Authorization", "Bearer typed-error-key")
      .send({ to: "6281234567890", text: "Hello" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      error: "DUPLICATE_MESSAGE",
      message: "Message already accepted",
    });
  });
});
