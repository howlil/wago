import { config } from "../config/index.js";
import { ApplicationError } from "../errors/application-error.js";

export function normalizePhone(input: string): string {
  const stripped = input.replace(/[\s+-]/g, "");

  if (stripped.startsWith("0")) {
    return `${config.defaultCountryCode}${stripped.slice(1)}`;
  }

  return stripped;
}

export function toWhatsAppJid(phone: string): string {
  const normalized = normalizePhone(phone);

  if (!/^\d+$/.test(normalized)) {
    throw new ApplicationError("INVALID_PHONE", "Phone number must contain digits only after normalization");
  }

  return `${normalized}@s.whatsapp.net`;
}
