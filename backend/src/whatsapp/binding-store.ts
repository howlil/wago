import { getDatabase } from "../infrastructure/database.js";

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

type BindingRow = {
  state: "unbound" | "bound";
  jid: string | null;
  phone: string | null;
  bound_at: string | null;
};

const database = getDatabase();
const selectBinding = database.prepare("SELECT state, jid, phone, bound_at FROM whatsapp_binding WHERE id = 1");
const upsertBinding = database.prepare(`
  INSERT INTO whatsapp_binding (id, state, jid, phone, bound_at)
  VALUES (1, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    state = excluded.state,
    jid = excluded.jid,
    phone = excluded.phone,
    bound_at = excluded.bound_at
`);

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
  const row = selectBinding.get() as BindingRow | undefined;

  if (row?.state !== "bound" || !row.jid || !row.phone || !row.bound_at) {
    return unboundBinding;
  }

  return {
    state: "bound",
    jid: row.jid,
    phone: row.phone,
    boundAt: row.bound_at,
  };
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

  upsertBinding.run(binding.state, binding.jid, binding.phone, binding.boundAt);
  return binding;
}

export function clearWhatsAppBinding(): void {
  database.prepare("DELETE FROM whatsapp_binding WHERE id = 1").run();
}
