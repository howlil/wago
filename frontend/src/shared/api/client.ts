const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

type RequestJsonOptions = {
  allowedStatuses?: number[];
};

type ErrorEnvelope = {
  success?: false;
  error?: string;
  message?: string;
  retryAt?: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAt?: string;
  readonly body: unknown;

  constructor(status: number, code: string, message: string, body: unknown, retryAt?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryAt = retryAt;
    this.body = body;
  }
}

function toApiError(status: number, body: unknown, fallbackMessage: string): ApiError {
  const envelope = body && typeof body === "object" ? (body as ErrorEnvelope) : undefined;
  const code = typeof envelope?.error === "string" ? envelope.error : "HTTP_ERROR";
  const message = typeof envelope?.message === "string" ? envelope.message : fallbackMessage;
  const retryAt = typeof envelope?.retryAt === "string" ? envelope.retryAt : undefined;
  return new ApiError(status, code, message, body, retryAt);
}

async function readResponseBody(response: Response): Promise<{ body: unknown; isJson: boolean }> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return { body: await response.json(), isJson: true };
  }

  return { body: await response.text(), isJson: false };
}

export async function requestJson<T>(path: string, init?: RequestInit, options: RequestJsonOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
  });
  const { body, isJson } = await readResponseBody(response);

  if (!isJson) {
    const message = typeof body === "string" && body ? body : "Expected a JSON response";
    throw new ApiError(response.status, "NON_JSON_RESPONSE", message, body);
  }

  if (!response.ok && !options.allowedStatuses?.includes(response.status)) {
    throw toApiError(response.status, body, `Request failed with HTTP ${response.status}`);
  }

  return body as T;
}

export async function requestText(path: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
  const { body, isJson } = await readResponseBody(response);

  if (!response.ok) {
    throw toApiError(response.status, body, `Request failed with HTTP ${response.status}`);
  }

  if (isJson || typeof body !== "string") {
    throw new ApiError(response.status, "NON_TEXT_RESPONSE", "Expected a text response", body);
  }

  return body;
}
