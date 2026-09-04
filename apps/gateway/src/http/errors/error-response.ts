import { type ApplicationErrorCode, isApplicationError } from "../../errors/application-error.js";

const statusByCode = {
  WHATSAPP_NOT_CONNECTED: 503,
  RECIPIENT_NOT_ALLOWED: 403,
  RECIPIENT_OPTED_OUT: 403,
  DUPLICATE_MESSAGE: 409,
  RECIPIENT_RATE_LIMITED: 429,
  ACCOUNT_RATE_LIMITED: 429,
  NEW_CHAT_RATE_LIMITED: 429,
  WA_REACHOUT_RESTRICTED: 429,
  WA_NEW_CHAT_CAPPED: 429,
  REACHOUT_RESTRICTED: 429,
  OUTBOUND_PAUSED: 503,
  OUTBOUND_STATE_PERSIST_FAILED: 500,
  PHONE_NOT_ON_WHATSAPP: 404,
  MESSAGE_REJECTED: 502,
  MESSAGE_CONTEXT_UNAVAILABLE: 409,
  INBOUND_MEDIA_UNAVAILABLE: 410,
  MEDIA_DOWNLOAD_FAILED: 502,
  INVALID_PHONE: 400,
  INVALID_AUDIT_CURSOR: 400,
  INVALID_WEBHOOK_SETTINGS: 400,
} satisfies Record<ApplicationErrorCode, number>;

export type HttpErrorResponse = {
  status: number;
  body: {
    success: false;
    error: ApplicationErrorCode;
    message: string;
    retryAt?: string;
  };
};

export function toHttpErrorResponse(error: unknown): HttpErrorResponse | null {
  if (!isApplicationError(error)) {
    return null;
  }

  return {
    status: statusByCode[error.code],
    body: {
      success: false,
      error: error.code,
      message: error.message,
      ...(error.retryAt ? { retryAt: error.retryAt.toISOString() } : {}),
    },
  };
}
