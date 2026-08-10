export type ApplicationErrorCode =
  | "WHATSAPP_NOT_CONNECTED"
  | "RECIPIENT_NOT_ALLOWED"
  | "RECIPIENT_OPTED_OUT"
  | "DUPLICATE_MESSAGE"
  | "RECIPIENT_RATE_LIMITED"
  | "ACCOUNT_RATE_LIMITED"
  | "NEW_CHAT_RATE_LIMITED"
  | "WA_REACHOUT_RESTRICTED"
  | "WA_NEW_CHAT_CAPPED"
  | "REACHOUT_RESTRICTED"
  | "OUTBOUND_PAUSED"
  | "OUTBOUND_STATE_PERSIST_FAILED"
  | "PHONE_NOT_ON_WHATSAPP"
  | "MESSAGE_REJECTED"
  | "INVALID_PHONE"
  | "INVALID_AUDIT_CURSOR";

export type ApplicationErrorOptions = {
  retryAt?: Date;
  cause?: unknown;
};

export class ApplicationError extends Error {
  readonly code: ApplicationErrorCode;
  readonly retryAt?: Date;

  constructor(code: ApplicationErrorCode, message: string, options: ApplicationErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ApplicationError";
    this.code = code;
    this.retryAt = options.retryAt;
  }
}

export function isApplicationError(error: unknown): error is ApplicationError {
  return error instanceof ApplicationError;
}
