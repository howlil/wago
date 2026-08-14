import { parseDeliveryWebhookConfig } from "../../config/webhook-config.js";
import { getDatabase } from "../../infrastructure/database.js";
import { createWebhookSettingsStore } from "./settings-store.js";

export const webhookSettingsStore = createWebhookSettingsStore(getDatabase());

if (!webhookSettingsStore.get()) {
  webhookSettingsStore.importLegacyIfEmpty(parseDeliveryWebhookConfig(process.env));
}
