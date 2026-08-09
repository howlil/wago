export {
  getCurrentQr,
  getMessageStatus,
  getWhatsAppStatus,
  initializeWhatsApp,
  rebindWhatsApp,
  type SendTextMessageOptions,
  type SendTextMessageResult,
  sendTextMessage,
  shutdownWhatsApp,
  type WhatsAppStatus,
  type WhatsAppStatusSnapshot,
} from "./whatsapp/client.js";

export type { MessageDeliveryStatus, StoredMessageStatus } from "./whatsapp/message-status-store.js";
