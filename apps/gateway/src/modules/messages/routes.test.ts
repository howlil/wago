import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetAccessStateForTest } from "../access/api-key.js";
import { createMessageRouter } from "./routes.js";

vi.mock("../activity/store.js", () => ({ recordActivity: vi.fn() }));

const deps = {
  sendText: vi.fn(),
  sendMedia: vi.fn(),
  downloadInboundMedia: vi.fn(),
  getStatus: vi.fn(),
  getWebhookDelivery: vi.fn(),
  createMessageId: vi.fn(() => "generated-message-id"),
};

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/messages", createMessageRouter(deps));
  return app;
}

describe("message routes", () => {
  beforeEach(() => {
    resetAccessStateForTest({ apiKey: "contract-key", apiKeySource: "env" });
    for (const mock of Object.values(deps)) mock.mockClear();
  });

  it("sends text through the injected transport operation", async () => {
    deps.sendText.mockResolvedValue({ messageId: "generated-message-id", status: "pending" });

    const response = await request(makeApp())
      .post("/messages/send")
      .set("Authorization", "Bearer contract-key")
      .set("Idempotency-Key", "idem-1")
      .send({ to: "6281234567890", text: "Hello", replyToMessageId: "in_1" });

    expect(response.status).toBe(202);
    expect(deps.sendText).toHaveBeenCalledWith("6281234567890", "Hello", {
      idempotencyKey: "idem-1",
      messageId: "generated-message-id",
      replyToMessageId: "in_1",
    });
  });

  it("passes raw media bytes without URL fetching", async () => {
    deps.sendMedia.mockResolvedValue({ messageId: "generated-message-id", status: "pending" });
    const payload = Buffer.from("png-bytes");

    const response = await request(makeApp())
      .post("/messages/send-media")
      .set("Authorization", "Bearer contract-key")
      .set("Idempotency-Key", "idem-media")
      .set("X-Wago-To", "6281234567890")
      .set("X-Wago-Media-Kind", "image")
      .set("X-Wago-Caption", "proof")
      .set("X-Wago-Reply-To", "in_media")
      .set("Content-Type", "image/png")
      .send(payload);

    expect(response.status).toBe(202);
    expect(deps.sendMedia).toHaveBeenCalledWith(
      "6281234567890",
      {
        kind: "image",
        data: expect.any(Buffer),
        mimetype: "image/png",
        caption: "proof",
      },
      {
        idempotencyKey: "idem-media",
        messageId: "generated-message-id",
        replyToMessageId: "in_media",
      },
    );
    expect(deps.sendMedia.mock.calls[0]?.[1]?.data.equals(payload)).toBe(true);
  });

  it("returns recent inbound media with no-store semantics", async () => {
    deps.downloadInboundMedia.mockResolvedValue({
      data: Buffer.from("document-bytes"),
      media: { kind: "document", mimetype: "application/pdf", fileName: "proof.pdf" },
    });

    const response = await request(makeApp())
      .get("/messages/incoming/in_media/media")
      .set("Authorization", "Bearer contract-key");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["content-disposition"]).toContain("proof.pdf");
    expect(deps.downloadInboundMedia).toHaveBeenCalledWith("in_media");
  });

  it("returns sanitized status", async () => {
    deps.getStatus.mockReturnValue({
      id: "m-1",
      providerMessageId: "provider-1",
      recipientJid: "6281234567890@s.whatsapp.net",
      to: "6281234567890@s.whatsapp.net",
      status: "accepted",
      dispatchState: "submitted",
      createdAt: "2026-08-10T16:59:59.000Z",
      updatedAt: "2026-08-10T17:00:00.000Z",
    });

    const response = await request(makeApp()).get("/messages/m-1/status").set("Authorization", "Bearer contract-key");

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty("providerMessageId");
    expect(response.body).not.toHaveProperty("recipientJid");
    expect(response.body).not.toHaveProperty("dispatchState");
    expect(response.body.to).toBe("6281234567890@s.whatsapp.net");
  });

  it("returns sanitized end-to-end diagnostics", async () => {
    deps.getStatus.mockReturnValue({
      id: "m-1",
      providerMessageId: "provider-1",
      recipientJid: "6281234567890@s.whatsapp.net",
      to: "6281234567890@s.whatsapp.net",
      status: "accepted",
      dispatchState: "submitted",
      createdAt: "2026-08-10T16:59:59.000Z",
      updatedAt: "2026-08-10T17:00:00.000Z",
      acceptedAt: "2026-08-10T17:00:00.000Z",
    });
    deps.getWebhookDelivery.mockReturnValue({
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
    });

    const response = await request(makeApp()).get("/messages/m-1").set("Authorization", "Bearer contract-key");

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty("to");
    expect(response.body).not.toHaveProperty("providerMessageId");
    expect(response.body).not.toHaveProperty("recipientJid");
    expect(response.body.dispatchState).toBe("submitted");
    expect(response.body.webhook.status).toBe("delivered");
  });
});
