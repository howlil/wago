import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../config/index.js";

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

const bindingFile = resolve(config.dataDirectory, "whatsapp-binding.json");
const unboundBinding: WhatsAppBinding = {
  state: "unbound",
  jid: null,
  phone: null,
  boundAt: null,
};

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

export function getWhatsAppBinding(): WhatsAppBinding {
  if (!existsSync(bindingFile)) {
    return unboundBinding;
  }

  try {
    const stored = JSON.parse(readFileSync(bindingFile, "utf8")) as Partial<WhatsAppBinding>;

    if (stored.state !== "bound" || !stored.jid || !stored.phone || !stored.boundAt) {
      return unboundBinding;
    }

    return {
      state: "bound",
      jid: stored.jid,
      phone: stored.phone,
      boundAt: stored.boundAt,
    };
  } catch {
    return unboundBinding;
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

  mkdirSync(config.dataDirectory, { recursive: true });
  writeFileSync(bindingFile, `${JSON.stringify(binding, null, 2)}\n`, { mode: 0o600 });

  return binding;
}

export function clearWhatsAppBinding(): void {
  rmSync(bindingFile, { force: true });
}
