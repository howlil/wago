import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { config } from "../config/index.js";
import { toWhatsAppJid } from "../utils/phone.js";

export type RecipientRecord = {
  jid: string;
  resolvedJid?: string;
  label?: string;
  allowed: boolean;
  optedOut: boolean;
  createdAt: string;
  updatedAt: string;
};

type RecipientFile = Record<string, RecipientRecord>;

const recipientsFile =
  process.env.NODE_ENV === "test"
    ? resolve(config.dataDirectory, `recipients-${process.pid}.json`)
    : resolve(config.dataDirectory, "recipients.json");

function nowIso(): string {
  return new Date().toISOString();
}

async function readRecipientFile(): Promise<RecipientFile> {
  try {
    const raw = await readFile(recipientsFile, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return parsed as RecipientFile;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

async function writeRecipientFile(recipients: RecipientFile): Promise<void> {
  await mkdir(dirname(recipientsFile), { recursive: true });

  const tmpFile = `${recipientsFile}.${process.pid}.tmp`;
  await writeFile(tmpFile, `${JSON.stringify(recipients, null, 2)}\n`, { mode: 0o600 });
  await rename(tmpFile, recipientsFile);
}

export async function listRecipients(): Promise<RecipientRecord[]> {
  const recipients = await readRecipientFile();

  return Object.values(recipients).sort((a, b) => a.jid.localeCompare(b.jid));
}

export async function getRecipientByJid(jid: string): Promise<RecipientRecord | null> {
  const recipients = await readRecipientFile();

  return recipients[jid] ?? null;
}

export async function allowRecipient(phone: string, label?: string): Promise<RecipientRecord> {
  const jid = toWhatsAppJid(phone);

  return allowRecipientJid(jid, label);
}

export async function allowRecipientJid(jid: string, label?: string): Promise<RecipientRecord> {
  const recipients = await readRecipientFile();
  const existing = recipients[jid];
  const timestamp = nowIso();
  const record: RecipientRecord = {
    jid,
    resolvedJid: existing?.resolvedJid,
    label: label?.trim() || existing?.label,
    allowed: true,
    optedOut: false,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  recipients[jid] = record;
  await writeRecipientFile(recipients);

  return record;
}

export async function optOutRecipient(phone: string): Promise<RecipientRecord> {
  const jid = toWhatsAppJid(phone);
  const recipients = await readRecipientFile();
  const existing = recipients[jid];
  const timestamp = nowIso();
  const record: RecipientRecord = {
    jid,
    resolvedJid: existing?.resolvedJid,
    label: existing?.label,
    allowed: existing?.allowed ?? false,
    optedOut: true,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  recipients[jid] = record;
  await writeRecipientFile(recipients);

  return record;
}

export async function rememberRecipientResolution(jid: string, resolvedJid: string): Promise<void> {
  const recipients = await readRecipientFile();
  const existing = recipients[jid];

  if (!existing) {
    return;
  }

  recipients[jid] = {
    ...existing,
    resolvedJid,
    updatedAt: nowIso(),
  };
  await writeRecipientFile(recipients);
}

export async function resetRecipientStoreForTest(): Promise<void> {
  await writeRecipientFile({});
}
