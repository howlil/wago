import { createHmac, randomUUID } from "node:crypto";

export const WEBHOOK_SCHEMA_VERSION = "1" as const;

export type MessageDeliveryWebhookStatus = "accepted" | "rejected";
export type MessageDeliveryWebhookEvent = "message.server_accepted" | "message.rejected";
export type WebhookEvent = MessageDeliveryWebhookEvent | "wago.test";

export type MessageDeliveryWebhookInput = {
  messageId: string;
  status: MessageDeliveryWebhookStatus;
  error?: string;
};

export type MessageDeliveryWebhookEnvelope = {
  version: typeof WEBHOOK_SCHEMA_VERSION;
  id: string;
  event: MessageDeliveryWebhookEvent;
  createdAt: string;
  data: {
    messageId: string;
    status: MessageDeliveryWebhookStatus;
    error?: string;
  };
};

export type TestWebhookEnvelope = {
  version: typeof WEBHOOK_SCHEMA_VERSION;
  id: string;
  event: "wago.test";
  createdAt: string;
  data: Record<string, never>;
};

export type WebhookEnvelope = MessageDeliveryWebhookEnvelope | TestWebhookEnvelope;

export type WebhookAttemptTarget = {
  id: string;
  event: WebhookEvent;
  payloadJson: string;
};

export type WebhookAttemptResult =
  | { ok: true; statusCode: number }
  | {
      ok: false;
      retryable: boolean;
      statusCode: number | null;
      errorCode:
        | "WEBHOOK_TIMEOUT"
        | "WEBHOOK_NETWORK_ERROR"
        | "WEBHOOK_REDIRECT_REJECTED"
        | "WEBHOOK_HTTP_CLIENT_ERROR"
        | "WEBHOOK_HTTP_SERVER_ERROR";
    };

type WebhookFetchResponse = {
  ok: boolean;
  status: number;
};

type WebhookFetch = (url: string, init: RequestInit) => Promise<WebhookFetchResponse>;

type EnvelopeDependencies = {
  createDeliveryId?: () => string;
  now?: () => Date;
};

type WebhookAttemptSenderDependencies = {
  url: string;
  secrets: readonly string[];
  fetchImpl?: WebhookFetch;
  now?: () => Date;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 5_000;

function eventForStatus(status: MessageDeliveryWebhookStatus): MessageDeliveryWebhookEvent {
  return status === "accepted" ? "message.server_accepted" : "message.rejected";
}

export function createMessageDeliveryWebhookEnvelope(
  input: MessageDeliveryWebhookInput,
  deps: EnvelopeDependencies = {},
): MessageDeliveryWebhookEnvelope {
  const createDeliveryId = deps.createDeliveryId ?? randomUUID;
  const now = deps.now ?? (() => new Date());
  const data: MessageDeliveryWebhookEnvelope["data"] = {
    messageId: input.messageId,
    status: input.status,
  };

  if (input.status === "rejected" && input.error) {
    data.error = input.error;
  }

  return {
    version: WEBHOOK_SCHEMA_VERSION,
    id: createDeliveryId(),
    event: eventForStatus(input.status),
    createdAt: now().toISOString(),
    data,
  };
}

export function createTestWebhookEnvelope(deps: EnvelopeDependencies = {}): TestWebhookEnvelope {
  const createDeliveryId = deps.createDeliveryId ?? randomUUID;
  const now = deps.now ?? (() => new Date());

  return {
    version: WEBHOOK_SCHEMA_VERSION,
    id: createDeliveryId(),
    event: "wago.test",
    createdAt: now().toISOString(),
    data: {},
  };
}

export function serializeWebhookEnvelope(envelope: WebhookEnvelope): string {
  return JSON.stringify(envelope);
}

function signingMaterial(id: string, timestamp: string, body: string): string {
  return `${id}.${timestamp}.${body}`;
}

export function createWebhookSignatureHeader(input: {
  id: string;
  timestamp: string;
  body: string;
  secrets: readonly string[];
}): string {
  const uniqueSecrets = [...new Set(input.secrets.filter(Boolean))];
  if (uniqueSecrets.length === 0) {
    throw new Error("At least one webhook signing secret is required");
  }

  const material = signingMaterial(input.id, input.timestamp, input.body);
  return uniqueSecrets
    .map((secret) => `v1,${createHmac("sha256", secret).update(material).digest("base64")}`)
    .join(" ");
}

function classifyHttpFailure(status: number): Exclude<WebhookAttemptResult, { ok: true }> {
  if (status >= 300 && status < 400) {
    return {
      ok: false,
      retryable: false,
      statusCode: status,
      errorCode: "WEBHOOK_REDIRECT_REJECTED",
    };
  }

  if (status === 408 || status === 429) {
    return {
      ok: false,
      retryable: true,
      statusCode: status,
      errorCode: "WEBHOOK_HTTP_CLIENT_ERROR",
    };
  }

  if (status >= 500) {
    return {
      ok: false,
      retryable: true,
      statusCode: status,
      errorCode: "WEBHOOK_HTTP_SERVER_ERROR",
    };
  }

  return {
    ok: false,
    retryable: false,
    statusCode: status,
    errorCode: "WEBHOOK_HTTP_CLIENT_ERROR",
  };
}

export function createWebhookAttemptSender(deps: WebhookAttemptSenderDependencies) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => new Date());
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async send(delivery: WebhookAttemptTarget): Promise<WebhookAttemptResult> {
      const timestamp = Math.floor(now().getTime() / 1000).toString();
      const signature = createWebhookSignatureHeader({
        id: delivery.id,
        timestamp,
        body: delivery.payloadJson,
        secrets: deps.secrets,
      });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      timeout.unref();

      try {
        const response = await fetchImpl(deps.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Wago-Webhooks/1.0",
            "Webhook-Id": delivery.id,
            "Webhook-Timestamp": timestamp,
            "Webhook-Signature": signature,
            "X-Wago-Delivery": delivery.id,
            "X-Wago-Event": delivery.event,
          },
          body: delivery.payloadJson,
          signal: controller.signal,
          redirect: "manual",
        });

        if (response.ok) {
          return { ok: true, statusCode: response.status };
        }

        return classifyHttpFailure(response.status);
      } catch {
        return controller.signal.aborted
          ? {
              ok: false,
              retryable: true,
              statusCode: null,
              errorCode: "WEBHOOK_TIMEOUT",
            }
          : {
              ok: false,
              retryable: true,
              statusCode: null,
              errorCode: "WEBHOOK_NETWORK_ERROR",
            };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
