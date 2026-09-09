import { getMessageStatus } from "../modules/messages/index.js";
import { createMessageRouter } from "../modules/messages/routes.js";
import { getMessageWebhookDelivery } from "../modules/webhooks/index.js";
import { downloadRecentInboundMedia, sendMediaMessage, sendTextMessage } from "../modules/whatsapp/index.js";

export function createHttpComposition() {
  return {
    messageRouter: createMessageRouter({
      sendText: sendTextMessage,
      sendMedia: sendMediaMessage,
      downloadInboundMedia: downloadRecentInboundMedia,
      getStatus: getMessageStatus,
      getWebhookDelivery: getMessageWebhookDelivery,
    }),
  };
}
