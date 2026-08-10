import { getDatabase } from "../infrastructure/database.js";

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

const database = getDatabase();
const selectPolicy = database.prepare("SELECT payload FROM outbound_policy_state WHERE id = 1");
const upsertPolicy = database.prepare(`
  INSERT INTO outbound_policy_state (id, payload, updated_at)
  VALUES (1, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    payload = excluded.payload,
    updated_at = excluded.updated_at
`);

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

function readStateFromDatabase(): OutboundPolicyState {
  const row = selectPolicy.get() as { payload?: string } | undefined;
  if (!row?.payload) {
    return defaultState();
  }

  try {
    const parsed = JSON.parse(row.payload) as unknown;
    return isOutboundPolicyState(parsed) ? parsed : defaultState();
  } catch {
    return defaultState();
  }
}

function persistState(state: OutboundPolicyState): void {
  upsertPolicy.run(JSON.stringify(state), new Date().toISOString());
}

let cachedState = readStateFromDatabase();

export function getOutboundPolicyState(): OutboundPolicyState {
  return cachedState;
}

export function mutateOutboundPolicyState<T>(mutator: (state: OutboundPolicyState) => T): {
  result: T;
  persisted: Promise<void>;
} {
  const nextState = cloneState(cachedState);
  const result = mutator(nextState);
  persistState(nextState);
  cachedState = nextState;

  return {
    result,
    persisted: Promise.resolve(),
  };
}

export function reloadOutboundPolicyState(): void {
  cachedState = readStateFromDatabase();
}

export async function flushOutboundPolicyStore(): Promise<void> {
  // SQLite commits writes synchronously on the shared connection.
}

export async function forgetOutboundPolicyMemoryForTest(): Promise<void> {
  reloadOutboundPolicyState();
}

export function resetOutboundPolicyStoreForTest(): Promise<void> {
  const nextState = defaultState();
  persistState(nextState);
  cachedState = nextState;
  return Promise.resolve();
}
