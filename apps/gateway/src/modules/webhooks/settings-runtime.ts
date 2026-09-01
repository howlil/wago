import { getDatabase } from "../../infrastructure/database.js";
import { createWebhookSettingsStore } from "./settings-store.js";

export const webhookSettingsStore = createWebhookSettingsStore(getDatabase());
