import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../config/index.js";
import { JsonFileCorruptionError, readJsonFileSync, writeJsonFileAtomicSync } from "../infrastructure/json-file.js";

export type WhatsAppBinding =
  | {
      state: "unbound";
      jid: null;
      phone: null;
      boundAt: null;
    }
  | {
      state: "bound";
      jid: string;
      phone: string;
      boundAt: string;
    };

const BINDING_VERSION = 1 as const;
const bindingFile = resolve(config.dataDirectory, "whatsapp-binding.json");
const unboundBinding: WhatsAppBinding = {
  state: "unbound",
  jid: null,
  phone: null,
  boundAt: null,
};

type BindingEnvelope = {
  version: typeof BINDING_VERSION;
  data: WhatsAppBinding;
};

type BindingFile = WhatsAppBinding | BindingEnvelope;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isWhatsAppBinding(value: unknown): value is WhatsAppBinding {
  if (!isRecord(value)) {
    return false;
  }

  if (value.state === "unbound") {
    return value.jid === null && value.phone === null && value.boundAt === null;
  }

  return (
    value.state === "bound" &&
    typeof value.jid === "string" &&
    typeof value.phone === "string" &&
    typeof value.boundAt === "string"
  );
}

function isBindingFile(value: unknown): value is BindingFile {
  if (isWhatsAppBinding(value)) {
    return true;
  }

  return isRecord(value) && value.version === BINDING_VERSION && "data" in value && isWhatsAppBinding(value.data);
}

function normalizeAccountJid(jid: string): { jid: string; phone: string } {
  const [localPart, domain = "s.whatsapp.net"] = jid.trim().split("@");
  const phone = localPart?.split(":")[0]?.replace(/\D/g, "") ?? "";

  if (!phone) {
    throw new Error("WhatsApp account JID does not contain a phone number");
  }

  return {
    jid: `${phone}@${domain}`,
    phone,
  };
}

function writeBinding(binding: WhatsAppBinding): void {
  writeJsonFileAtomicSync(bindingFile, {
    version: BINDING_VERSION,
    data: binding,
  } satisfies BindingEnvelope);
}

export function getWhatsAppBinding(): WhatsAppBinding {
  try {
    const stored = readJsonFileSync(bindingFile, isBindingFile);

    if (!stored) {
      return unboundBinding;
    }

    const binding = "version" in stored ? stored.data : stored;

    if (!("version" in stored)) {
      writeBinding(binding);
    }

    return binding;
  } catch (error) {
    if (error instanceof JsonFileCorruptionError) {
      // Keep the .corrupt recovery copy and let a valid Baileys auth session
      // reconstruct the binding on the next successful connection.
      rmSync(bindingFile, { force: true });
      return unboundBinding;
    }

    throw error;
  }
}

export function bindWhatsAppAccount(jid: string): WhatsAppBinding {
  const account = normalizeAccountJid(jid);
  const current = getWhatsAppBinding();
  const binding: WhatsAppBinding = {
    state: "bound",
    jid: account.jid,
    phone: account.phone,
    boundAt: current.state === "bound" && current.jid === account.jid ? current.boundAt : new Date().toISOString(),
  };

  writeBinding(binding);
  return binding;
}

export function clearWhatsAppBinding(): void {
  rmSync(bindingFile, { force: true });
}
