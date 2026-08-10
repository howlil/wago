import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
import { ApplicationError, type ApplicationErrorCode } from "./errors/application-error.js";

function applicationError(code: ApplicationErrorCode, message: string): ApplicationError {
  return new ApplicationError(code, message);
}

function authenticated(requestBuilder: request.Test): request.Test {
  return requestBuilder.set("Authorization", "Bearer contract-key");
}

describe("HTTP message contracts", () => {
  beforeEach(() => {
    config.apiKey = "contract-key";
    config.apiKeyHash = null;
    config.apiKeySource = "env";
    config.allowWebBootstrap = false;
    config.nodeEnv = "test";
    config.requestLogging = false;

    whatsappMock.getCurrentQr.mockReset();
    whatsappMock.getMessageStatus.mockReset();
    whatsappMock.getWhatsAppStatus.mockReset();
    whatsappMock.pairWhatsApp.mockReset();
    whatsappMock.rebindWhatsApp.mockReset();
    whatsappMock.sendTextMessage.mockReset();

    whatsappMock.getCurrentQr.mockReturnValue({ qr: null, status: "disconnected" });
    whatsappMock.getWhatsAppStatus.mockReturnValue({
      status: "disconnected",
      binding: { state: "unbound" },
      accountHealth: { availability: "unavailable", unavailableReason: "not_connected" },
    });
    whatsappMock.pairWhatsApp.mockResolvedValue({ status: "connecting" });
    whatsappMock.rebindWhatsApp.mockResolvedValue({ status: "connecting" });
    whatsappMock.sendTextMessage.mockResolvedValue({ messageId: "message-1", status: "pending" });
  });

  it("returns the stable unauthorized contract for an invalid API key", async () => {
    const response = await request(app)
      .post("/messages/send")
      .set("Authorization", "Bearer wrong-key")
      .send({ to: "6281234567890", text: "Hello" });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      error: "UNAUTHORIZED",
      message: "Invalid API key",
    });
    expect(whatsappMock.sendTextMessage).not.toHaveBeenCalled();
  });

  it("returns the stable invalid-request contract before message orchestration", async () => {
    const response = await authenticated(request(app).post("/messages/send")).send({
      to: "6281234567890",
      text: "   ",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: "INVALID_REQUEST",
      message: "to and text are required",
    });
    expect(whatsappMock.sendTextMessage).not.toHaveBeenCalled();
  });

  it.each([
    ["RECIPIENT_NOT_ALLOWED", 403],
    ["RECIPIENT_OPTED_OUT", 403],
    ["DUPLICATE_MESSAGE", 409],
    ["RECIPIENT_RATE_LIMITED", 429],
    ["ACCOUNT_RATE_LIMITED", 429],
    ["NEW_CHAT_RATE_LIMITED", 429],
    ["WA_REACHOUT_RESTRICTED", 429],
    ["WA_NEW_CHAT_CAPPED", 429],
    ["OUTBOUND_PAUSED", 503],
  ] as const)(
    "maps outbound policy error %s to HTTP %i without changing its public code",
    async (errorCode, status) => {
      whatsappMock.sendTextMessage.mockRejectedValueOnce(applicationError(errorCode, `blocked: ${errorCode}`));

      const response = await authenticated(request(app).post("/messages/send")).send({
        to: "6281234567890",
        text: "Hello",
      });

      expect(response.status).toBe(status);
      expect(response.body).toEqual({
        success: false,
        error: errorCode,
        message: `blocked: ${errorCode}`,
      });
    },
  );

  it("returns the stable unavailable contract when WhatsApp is disconnected", async () => {
    whatsappMock.sendTextMessage.mockRejectedValueOnce(
      applicationError("WHATSAPP_NOT_CONNECTED", "WhatsApp is not connected"),
    );

    const response = await authenticated(request(app).post("/messages/send")).send({
      to: "6281234567890",
      text: "Hello",
    });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      error: "WHATSAPP_NOT_CONNECTED",
      message: "WhatsApp is not connected",
    });
  });

  it("sanitizes unexpected send failures instead of exposing internal error details", async () => {
    whatsappMock.sendTextMessage.mockRejectedValueOnce(new Error("database password leaked here"));

    const response = await authenticated(request(app).post("/messages/send")).send({
      to: "6281234567890",
      text: "Hello",
    });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: "SEND_MESSAGE_FAILED",
      message: "Failed to send WhatsApp message",
    });
    expect(JSON.stringify(response.body)).not.toContain("database password");
  });

  it("returns the stable not-found contract for expired or unknown message status", async () => {
    whatsappMock.getMessageStatus.mockReturnValueOnce(undefined);

    const response = await authenticated(request(app).get("/messages/expired-message/status"));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: "MESSAGE_STATUS_NOT_FOUND",
      message: "Message status was not found or has expired",
    });
  });

  it("returns the current message-status payload unchanged when it exists", async () => {
    whatsappMock.getMessageStatus.mockReturnValueOnce({
      id: "message-1",
      to: "6281234567890@s.whatsapp.net",
      status: "accepted",
      updatedAt: "2026-08-10T17:00:00.000Z",
    });

    const response = await authenticated(request(app).get("/messages/message-1/status"));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      id: "message-1",
      to: "6281234567890@s.whatsapp.net",
      status: "accepted",
      updatedAt: "2026-08-10T17:00:00.000Z",
    });
  });
});
