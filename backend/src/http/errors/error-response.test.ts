import { describe, expect, it } from "vitest";
import { ApplicationError } from "../../errors/application-error.js";
import { toHttpErrorResponse } from "./error-response.js";

describe("toHttpErrorResponse", () => {
  it("maps stable application error codes without putting HTTP concerns on the error", () => {
    const error = new ApplicationError("DUPLICATE_MESSAGE", "Message already accepted");

    expect(error).not.toHaveProperty("status");
    expect(toHttpErrorResponse(error)).toEqual({
      status: 409,
      body: {
        success: false,
        error: "DUPLICATE_MESSAGE",
        message: "Message already accepted",
      },
    });
  });

  it.each([
    ["RECIPIENT_NOT_ALLOWED", 403],
    ["RECIPIENT_OPTED_OUT", 403],
    ["RECIPIENT_RATE_LIMITED", 429],
    ["ACCOUNT_RATE_LIMITED", 429],
    ["NEW_CHAT_RATE_LIMITED", 429],
    ["WA_REACHOUT_RESTRICTED", 429],
    ["WA_NEW_CHAT_CAPPED", 429],
    ["REACHOUT_RESTRICTED", 429],
    ["OUTBOUND_PAUSED", 503],
    ["WHATSAPP_NOT_CONNECTED", 503],
    ["RECIPIENT_NOT_ON_WHATSAPP", 422],
    ["RECIPIENT_LOOKUP_FAILED", 502],
    ["MESSAGE_REJECTED", 502],
    ["INVALID_PHONE", 400],
    ["INVALID_AUDIT_CURSOR", 400],
  ] as const)("maps %s to HTTP %i", (code, status) => {
    expect(toHttpErrorResponse(new ApplicationError(code, `error: ${code}`))).toMatchObject({
      status,
      body: { success: false, error: code, message: `error: ${code}` },
    });
  });

  it("serializes retry metadata", () => {
    const retryAt = new Date("2026-08-10T12:00:00.000Z");

    expect(
      toHttpErrorResponse(new ApplicationError("ACCOUNT_RATE_LIMITED", "Rate limit exceeded", { retryAt })),
    ).toEqual({
      status: 429,
      body: {
        success: false,
        error: "ACCOUNT_RATE_LIMITED",
        message: "Rate limit exceeded",
        retryAt: retryAt.toISOString(),
      },
    });
  });

  it("does not classify unexpected errors as safe public application errors", () => {
    expect(toHttpErrorResponse(new Error("internal database detail"))).toBeNull();
  });
});
