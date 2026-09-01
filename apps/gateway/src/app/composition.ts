import { getMessageStatus } from "../modules/messages/index.js";
import { createMessageService } from "../modules/messages/message.service.js";
import { createMessageRouter } from "../modules/messages/routes.js";
import { getMessageWebhookDelivery } from "../modules/webhooks/index.js";
import { sendTextMessage } from "../modules/whatsapp/index.js";

export function createHttpComposition() {
  const messageService = createMessageService({
    sendText: sendTextMessage,
    getStatus: getMessageStatus,
    getWebhookDelivery: getMessageWebhookDelivery,
  });

  return {
    messageRouter: createMessageRouter(messageService),
  };
}
