export {
  getCurrentQr,
  getMessageStatus,
  getWhatsAppStatus,
  initializeWhatsApp,
  rebindWhatsApp,
  sendTextMessage,
  shutdownWhatsApp,
  type SendTextMessageOptions,
  type SendTextMessageResult,
  type WhatsAppStatus,
  type WhatsAppStatusSnapshot
} from "./whatsapp/client.js";

export type { MessageDeliveryStatus, StoredMessageStatus } from "./whatsapp/message-status-store.js";
