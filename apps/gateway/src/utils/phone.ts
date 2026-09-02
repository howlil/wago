import { ApplicationError } from "../errors/application-error.js";

const DEFAULT_COUNTRY_CODE = "62";

export function normalizePhone(input: string): string {
  const stripped = input.replace(/[\s+-]/g, "");

  if (stripped.startsWith("0")) {
    return `${DEFAULT_COUNTRY_CODE}${stripped.slice(1)}`;
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
