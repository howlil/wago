import { config } from "../config/index.js";
import { logger } from "../infrastructure/logger.js";
import { createDeliveryWebhookDispatcher, type MessageDeliveryWebhookInput } from "./delivery-webhook-core.js";

const hasWebhookUrl = Boolean(config.deliveryWebhookUrl);
const hasWebhookSecret = Boolean(config.deliveryWebhookSecret);

if (hasWebhookUrl !== hasWebhookSecret) {
  logger.warn(
    { event: "webhook.config.incomplete" },
    "Delivery webhook is disabled because WEBHOOK_URL and WEBHOOK_SECRET must be configured together",
  );
}

const dispatcher = createDeliveryWebhookDispatcher({
  url: hasWebhookUrl && hasWebhookSecret ? config.deliveryWebhookUrl : null,
  secret: hasWebhookUrl && hasWebhookSecret ? config.deliveryWebhookSecret : null,
  logger: {
    info: (fields, message) => logger.info(fields, message),
    warn: (fields, message) => logger.warn(fields, message),
    error: (fields, message) => logger.error(fields, message),
  },
});

export function dispatchMessageDeliveryWebhook(input: MessageDeliveryWebhookInput): Promise<void> {
  return dispatcher.dispatch(input);
}
