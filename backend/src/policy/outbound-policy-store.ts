import { resolve } from "node:path";
import { config } from "../config/index.js";
import { readJsonFileSync, writeJsonFileAtomic } from "../infrastructure/json-file.js";

export type OutboundPolicyState = {
  seenIdempotencyKeys: Record<string, number>;
  accountSendTimestamps: number[];
  recipientSendTimestamps: Record<string, number[]>;
  knownRecipients: Record<string, number>;
  newChatTimestamps: number[];
  recipientReachoutCooldowns: Record<string, number>;
  outboundPaused: boolean;
  outboundPauseMessage: string;
};

type OutboundPolicyEnvelope = {
  version: 1;
  data: OutboundPolicyState;
};
type StoredOutboundPolicyFile = OutboundPolicyState | OutboundPolicyEnvelope;

const STORE_VERSION = 1 as const;
const policyFile =
  process.env.NODE_ENV === "test"
    ? resolve(config.dataDirectory, `outbound-policy-${process.pid}.json`)
    : resolve(config.dataDirectory, "outbound-policy.json");

let writeQueue: Promise<void> = Promise.resolve();

function defaultState(): OutboundPolicyState {
  return {
    seenIdempotencyKeys: {},
    accountSendTimestamps: [],
    recipientSendTimestamps: {},
    knownRecipients: {},
    newChatTimestamps: [],
    recipientReachoutCooldowns: {},
    outboundPaused: false,
    outboundPauseMessage: "Outbound messaging is paused",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(isFiniteNumber);
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every(isFiniteNumber);
}

function isNumberArrayRecord(value: unknown): value is Record<string, number[]> {
  return isRecord(value) && Object.values(value).every(isNumberArray);
}

function isOutboundPolicyState(value: unknown): value is OutboundPolicyState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNumberRecord(value.seenIdempotencyKeys) &&
    isNumberArray(value.accountSendTimestamps) &&
    isNumberArrayRecord(value.recipientSendTimestamps) &&
    isNumberRecord(value.knownRecipients) &&
    isNumberArray(value.newChatTimestamps) &&
    isNumberRecord(value.recipientReachoutCooldowns) &&
    typeof value.outboundPaused === "boolean" &&
    typeof value.outboundPauseMessage === "string"
  );
}

function isStoredOutboundPolicyFile(value: unknown): value is StoredOutboundPolicyFile {
  if (isOutboundPolicyState(value)) {
    return true;
  }

  return (
    isRecord(value) && value.version === STORE_VERSION && "data" in value && isOutboundPolicyState(value.data)
  );
}

function cloneState(state: OutboundPolicyState): OutboundPolicyState {
  return {
    seenIdempotencyKeys: { ...state.seenIdempotencyKeys },
    accountSendTimestamps: [...state.accountSendTimestamps],
    recipientSendTimestamps: Object.fromEntries(
      Object.entries(state.recipientSendTimestamps).map(([jid, timestamps]) => [jid, [...timestamps]]),
    ),
    knownRecipients: { ...state.knownRecipients },
    newChatTimestamps: [...state.newChatTimestamps],
    recipientReachoutCooldowns: { ...state.recipientReachoutCooldowns },
    outboundPaused: state.outboundPaused,
    outboundPauseMessage: state.outboundPauseMessage,
  };
}

function readStateFromDisk(): OutboundPolicyState {
  const stored = readJsonFileSync(policyFile, isStoredOutboundPolicyFile);

  if (!stored) {
    return defaultState();
  }

  return "version" in stored ? stored.data : stored;
}

async function writeStateToDisk(state: OutboundPolicyState): Promise<void> {
  await writeJsonFileAtomic(policyFile, {
    version: STORE_VERSION,
    data: state,
  } satisfies OutboundPolicyEnvelope);
}

function enqueueSnapshot(snapshot: OutboundPolicyState): Promise<void> {
  const operation = writeQueue
    .catch(() => undefined)
    .then(() => writeStateToDisk(snapshot));

  writeQueue = operation.then(
    () => undefined,
    () => undefined,
  );

  return operation;
}

let cachedState = readStateFromDisk();

export function getOutboundPolicyState(): OutboundPolicyState {
  return cachedState;
}

export function mutateOutboundPolicyState<T>(
  mutator: (state: OutboundPolicyState) => T,
): { result: T; persisted: Promise<void> } {
  const result = mutator(cachedState);
  return {
    result,
    persisted: enqueueSnapshot(cloneState(cachedState)),
  };
}

export async function flushOutboundPolicyStore(): Promise<void> {
  await writeQueue;
}

export async function forgetOutboundPolicyMemoryForTest(): Promise<void> {
  await flushOutboundPolicyStore();
  cachedState = readStateFromDisk();
}

export function resetOutboundPolicyStoreForTest(): Promise<void> {
  cachedState = defaultState();
  return enqueueSnapshot(cloneState(cachedState));
}
