import { createHmac, randomUUID } from "node:crypto";

export type MessageDeliveryWebhookStatus = "accepted" | "rejected";

export type MessageDeliveryWebhookInput = {
  messageId: string;
  status: MessageDeliveryWebhookStatus;
  error?: string;
};

export type MessageDeliveryWebhookPayload = {
  id: string;
  event: `message.${MessageDeliveryWebhookStatus}`;
  createdAt: string;
  data: {
    messageId: string;
    status: MessageDeliveryWebhookStatus;
    error?: string;
  };
};

type WebhookFetchResponse = {
  ok: boolean;
  status: number;
};

type WebhookFetch = (url: string, init: RequestInit) => Promise<WebhookFetchResponse>;

type WebhookLogger = {
  info(fields: Record<string, unknown>, message?: string): void;
  warn(fields: Record<string, unknown>, message?: string): void;
  error(fields: Record<string, unknown>, message?: string): void;
};

type DeliveryWebhookDispatcherDependencies = {
  url: string | null;
  secret: string | null;
  fetchImpl?: WebhookFetch;
  sleep?: (delayMs: number) => Promise<void>;
  now?: () => Date;
  createDeliveryId?: () => string;
  timeoutMs?: number;
  retryDelaysMs?: readonly number[];
  logger?: WebhookLogger;
};

const DEFAULT_RETRY_DELAYS_MS = [0, 5_000, 30_000, 120_000, 600_000] as const;
const DEFAULT_TIMEOUT_MS = 5_000;

const silentLogger: WebhookLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, delayMs);
    timer.unref();
  });
}

function shouldRetry(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function createPayload(
  input: MessageDeliveryWebhookInput,
  deliveryId: string,
  createdAt: string,
): MessageDeliveryWebhookPayload {
  const data: MessageDeliveryWebhookPayload["data"] = {
    messageId: input.messageId,
    status: input.status,
  };

  if (input.status === "rejected" && input.error) {
    data.error = input.error;
  }

  return {
    id: deliveryId,
    event: `message.${input.status}`,
    createdAt,
    data,
  };
}

function signBody(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

export function createDeliveryWebhookDispatcher(deps: DeliveryWebhookDispatcherDependencies) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? (() => new Date());
  const createDeliveryId = deps.createDeliveryId ?? randomUUID;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryDelaysMs = deps.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const log = deps.logger ?? silentLogger;

  return {
    async dispatch(input: MessageDeliveryWebhookInput): Promise<void> {
      const url = deps.url?.trim() || null;
      const secret = deps.secret?.trim() || null;

      if (!url || !secret) {
        return;
      }

      const payload = createPayload(input, createDeliveryId(), now().toISOString());
      const body = JSON.stringify(payload);
      const signature = signBody(body, secret);

      for (let attemptIndex = 0; attemptIndex < retryDelaysMs.length; attemptIndex += 1) {
        const delayMs = retryDelaysMs[attemptIndex] ?? 0;
        if (delayMs > 0) {
          await sleep(delayMs);
        }

        const attempt = attemptIndex + 1;
        const isLastAttempt = attemptIndex === retryDelaysMs.length - 1;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        timeout.unref();

        try {
          const response = await fetchImpl(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Wago-Event": payload.event,
              "X-Wago-Delivery": payload.id,
              "X-Wago-Signature": signature,
            },
            body,
            signal: controller.signal,
          });

          if (response.ok) {
            log.info(
              {
                event: "webhook.delivery.succeeded",
                deliveryId: payload.id,
                webhookEvent: payload.event,
                attempt,
              },
              "Delivery webhook succeeded",
            );
            return;
          }

          if (!shouldRetry(response.status) || isLastAttempt) {
            log.warn(
              {
                event: "webhook.delivery.failed",
                deliveryId: payload.id,
                webhookEvent: payload.event,
                attempt,
                statusCode: response.status,
                retryable: shouldRetry(response.status),
              },
              "Delivery webhook failed",
            );
            return;
          }

          log.warn(
            {
              event: "webhook.delivery.retry_scheduled",
              deliveryId: payload.id,
              webhookEvent: payload.event,
              attempt,
              statusCode: response.status,
              nextDelayMs: retryDelaysMs[attemptIndex + 1] ?? null,
            },
            "Delivery webhook retry scheduled",
          );
        } catch (error) {
          if (isLastAttempt) {
            log.error(
              {
                event: "webhook.delivery.failed",
                deliveryId: payload.id,
                webhookEvent: payload.event,
                attempt,
                errorType: error instanceof Error ? error.name : typeof error,
              },
              "Delivery webhook exhausted retries",
            );
            return;
          }

          log.warn(
            {
              event: "webhook.delivery.retry_scheduled",
              deliveryId: payload.id,
              webhookEvent: payload.event,
              attempt,
              errorType: error instanceof Error ? error.name : typeof error,
              nextDelayMs: retryDelaysMs[attemptIndex + 1] ?? null,
            },
            "Delivery webhook retry scheduled",
          );
        } finally {
          clearTimeout(timeout);
        }
      }
    },
  };
}
