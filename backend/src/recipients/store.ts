import { resolve } from "node:path";
import { config } from "../config/index.js";
import { readJsonFile, writeJsonFileAtomic } from "../infrastructure/json-file.js";
import { toWhatsAppJid } from "../utils/phone.js";

export type RecipientRecord = {
  jid: string;
  resolvedJid?: string;
  label?: string;
  allowed: boolean;
  optedOut: boolean;
  createdAt: string;
  updatedAt: string;
  lastSuccessfulOutboundAt?: string;
};

type RecipientFile = Record<string, RecipientRecord>;
type RecipientEnvelope = {
  version: 1;
  data: RecipientFile;
};
type StoredRecipientFile = RecipientFile | RecipientEnvelope;

const RECIPIENT_STORE_VERSION = 1 as const;
const recipientsFile =
  process.env.NODE_ENV === "test"
    ? resolve(config.dataDirectory, `recipients-${process.pid}.json`)
    : resolve(config.dataDirectory, "recipients.json");

let mutationQueue: Promise<void> = Promise.resolve();

function nowIso(): string {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isRecipientRecord(value: unknown): value is RecipientRecord {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.jid === "string" &&
    isOptionalString(value.resolvedJid) &&
    isOptionalString(value.label) &&
    typeof value.allowed === "boolean" &&
    typeof value.optedOut === "boolean" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    isOptionalString(value.lastSuccessfulOutboundAt)
  );
}

function isRecipientMap(value: unknown): value is RecipientFile {
  return isRecord(value) && Object.values(value).every(isRecipientRecord);
}

function isStoredRecipientFile(value: unknown): value is StoredRecipientFile {
  if (isRecipientMap(value)) {
    return true;
  }

  return (
    isRecord(value) &&
    value.version === RECIPIENT_STORE_VERSION &&
    "data" in value &&
    isRecipientMap(value.data)
  );
}

async function readRecipientFileFromDisk(): Promise<RecipientFile> {
  const stored = await readJsonFile(recipientsFile, isStoredRecipientFile);

  if (!stored) {
    return {};
  }

  return "version" in stored ? stored.data : stored;
}

async function writeRecipientFile(recipients: RecipientFile): Promise<void> {
  await writeJsonFileAtomic(recipientsFile, {
    version: RECIPIENT_STORE_VERSION,
    data: recipients,
  } satisfies RecipientEnvelope);
}

async function mutateRecipients<T>(mutator: (recipients: RecipientFile) => T): Promise<T> {
  let result!: T;

  const operation = mutationQueue
    .catch(() => undefined)
    .then(async () => {
      const recipients = await readRecipientFileFromDisk();
      result = mutator(recipients);
      await writeRecipientFile(recipients);
    });

  mutationQueue = operation.then(
    () => undefined,
    () => undefined,
  );

  await operation;
  return result;
}

export async function flushRecipientStore(): Promise<void> {
  await mutationQueue;
}

export async function listRecipients(): Promise<RecipientRecord[]> {
  await flushRecipientStore();
  const recipients = await readRecipientFileFromDisk();

  return Object.values(recipients).sort((a, b) => a.jid.localeCompare(b.jid));
}

export async function getRecipientByJid(jid: string): Promise<RecipientRecord | null> {
  await flushRecipientStore();
  const recipients = await readRecipientFileFromDisk();

  return recipients[jid] ?? null;
}

export async function allowRecipient(phone: string, label?: string): Promise<RecipientRecord> {
  const jid = toWhatsAppJid(phone);

  return allowRecipientJid(jid, label);
}

export async function allowRecipientJid(jid: string, label?: string): Promise<RecipientRecord> {
  return mutateRecipients((recipients) => {
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
      lastSuccessfulOutboundAt: existing?.lastSuccessfulOutboundAt,
    };

    recipients[jid] = record;
    return record;
  });
}

export async function optOutRecipient(phone: string): Promise<RecipientRecord> {
  const jid = toWhatsAppJid(phone);

  return mutateRecipients((recipients) => {
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
      lastSuccessfulOutboundAt: existing?.lastSuccessfulOutboundAt,
    };

    recipients[jid] = record;
    return record;
  });
}

export async function rememberRecipientResolution(jid: string, resolvedJid: string): Promise<void> {
  await mutateRecipients((recipients) => {
    const existing = recipients[jid];

    if (!existing) {
      return;
    }

    recipients[jid] = {
      ...existing,
      resolvedJid,
      updatedAt: nowIso(),
    };
  });
}

export async function rememberSuccessfulOutbound(jid: string, resolvedJid?: string): Promise<void> {
  await mutateRecipients((recipients) => {
    const existing = recipients[jid];

    if (!existing) {
      return;
    }

    const timestamp = nowIso();
    recipients[jid] = {
      ...existing,
      resolvedJid: resolvedJid ?? existing.resolvedJid,
      lastSuccessfulOutboundAt: timestamp,
      updatedAt: timestamp,
    };
  });
}

export async function resetRecipientStoreForTest(): Promise<void> {
  await flushRecipientStore();
  await writeRecipientFile({});
}
