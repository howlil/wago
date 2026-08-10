export type ReachoutTimelockState = {
  isActive?: boolean;
  timeEnforcementEnds?: Date | string;
  enforcementType?: string;
};

export type NewChatMessageCapInfo = {
  total_quota?: number;
  used_quota?: number;
  cycle_start_timestamp?: string;
  cycle_end_timestamp?: string;
  server_sent_timestamp?: string;
  capping_status?: "NONE" | "FIRST_WARNING" | "SECOND_WARNING" | "CAPPED" | string;
};

export type AccountHealthFetcher = {
  fetchAccountReachoutTimelock: () => Promise<ReachoutTimelockState | undefined>;
  fetchNewChatMessageCap: () => Promise<NewChatMessageCapInfo | undefined>;
};

export type AccountHealthAvailability = "unavailable" | "checking" | "available";
export type AccountHealthUnavailableReason = "not_connected" | "session_invalid" | "fetch_failed";

export type AccountHealthSnapshot = {
  availability: AccountHealthAvailability;
  unavailableReason?: AccountHealthUnavailableReason;
  reachoutTimeLock?: {
    isActive: boolean;
    retryAt?: string;
    enforcementType?: string;
  };
  newChatCap?: NewChatMessageCapInfo;
  lastFetchedAt?: string;
  lastFetchErrorAt?: string;
};

export type AccountHealthDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: "WA_REACHOUT_RESTRICTED" | "WA_NEW_CHAT_CAPPED" | "NEW_CHAT_RATE_LIMITED";
      message: string;
      retryAt?: Date;
    };

const HEALTH_CACHE_TTL_MS = 1000 * 60 * 2;
const HEALTH_ERROR_TTL_MS = 1000 * 30;
const FALLBACK_REACHOUT_RESTRICTION_MS = 1000 * 60 * 30;

let availability: AccountHealthAvailability = "unavailable";
let unavailableReason: AccountHealthUnavailableReason | undefined = "not_connected";
let reachoutTimeLock: ReachoutTimelockState | undefined;
let newChatCap: NewChatMessageCapInfo | undefined;
let lastFetchedAt = 0;
let lastFetchErrorAt = 0;

function parseDate(value?: Date | string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeReachoutState(state?: ReachoutTimelockState): ReachoutTimelockState | undefined {
  if (!state) {
    return undefined;
  }

  return {
    ...state,
    timeEnforcementEnds: parseDate(state.timeEnforcementEnds),
  };
}

function isCacheStale(now: number): boolean {
  if (!lastFetchedAt) {
    return true;
  }

  return now - lastFetchedAt >= HEALTH_CACHE_TTL_MS;
}

function isFetchErrorCoolingDown(now: number): boolean {
  return Boolean(lastFetchErrorAt) && now - lastFetchErrorAt < HEALTH_ERROR_TTL_MS;
}

export function invalidateAccountHealth(reason: AccountHealthUnavailableReason): void {
  availability = "unavailable";
  unavailableReason = reason;
  reachoutTimeLock = undefined;
  newChatCap = undefined;
  lastFetchedAt = 0;
  lastFetchErrorAt = 0;
}

export async function refreshAccountHealth(
  fetcher: AccountHealthFetcher,
  options: { force?: boolean } = {},
): Promise<void> {
  const now = Date.now();

  if (!options.force && (!isCacheStale(now) || isFetchErrorCoolingDown(now))) {
    return;
  }

  availability = "checking";
  unavailableReason = undefined;

  try {
    const [nextReachoutTimeLock, nextNewChatCap] = await Promise.all([
      fetcher.fetchAccountReachoutTimelock(),
      fetcher.fetchNewChatMessageCap(),
    ]);

    reachoutTimeLock = normalizeReachoutState(nextReachoutTimeLock);
    newChatCap = nextNewChatCap;
    lastFetchedAt = now;
    lastFetchErrorAt = 0;
    availability = "available";
    unavailableReason = undefined;
  } catch {
    reachoutTimeLock = undefined;
    newChatCap = undefined;
    lastFetchErrorAt = now;
    availability = "unavailable";
    unavailableReason = "fetch_failed";
  }
}

export function updateReachoutTimeLock(state?: ReachoutTimelockState): void {
  reachoutTimeLock = normalizeReachoutState(state);
}

export function markReachoutRestricted(retryAt = new Date(Date.now() + FALLBACK_REACHOUT_RESTRICTION_MS)): void {
  reachoutTimeLock = {
    isActive: true,
    timeEnforcementEnds: retryAt,
    enforcementType: "UNKNOWN",
  };
}

export async function checkAccountHealth(
  fetcher: AccountHealthFetcher | undefined,
  options: { isNewRecipient: boolean },
): Promise<AccountHealthDecision> {
  if (fetcher) {
    await refreshAccountHealth(fetcher);
  }

  const now = new Date();
  const retryAt = parseDate(reachoutTimeLock?.timeEnforcementEnds);

  if (reachoutTimeLock?.isActive && retryAt && retryAt <= now) {
    reachoutTimeLock = {
      ...reachoutTimeLock,
      isActive: false,
    };
  }

  if (options.isNewRecipient && reachoutTimeLock?.isActive && (!retryAt || retryAt > now)) {
    return {
      allowed: false,
      reason: "WA_REACHOUT_RESTRICTED",
      message: "WhatsApp reports this account is restricted from starting new outbound reach-outs",
      retryAt,
    };
  }

  if (options.isNewRecipient && newChatCap?.capping_status === "CAPPED") {
    return {
      allowed: false,
      reason: "WA_NEW_CHAT_CAPPED",
      message: "WhatsApp reports this account has reached its new-chat cap",
    };
  }

  if (
    options.isNewRecipient &&
    (newChatCap?.capping_status === "FIRST_WARNING" || newChatCap?.capping_status === "SECOND_WARNING")
  ) {
    return {
      allowed: false,
      reason: "NEW_CHAT_RATE_LIMITED",
      message: "WhatsApp reports a new-chat warning, so new recipient sends are paused",
    };
  }

  return { allowed: true };
}

export function getAccountHealthSnapshot(): AccountHealthSnapshot {
  const retryAt = parseDate(reachoutTimeLock?.timeEnforcementEnds);

  return {
    availability,
    unavailableReason,
    reachoutTimeLock: reachoutTimeLock
      ? {
          isActive: Boolean(reachoutTimeLock.isActive),
          retryAt: retryAt?.toISOString(),
          enforcementType: reachoutTimeLock.enforcementType,
        }
      : undefined,
    newChatCap,
    lastFetchedAt: lastFetchedAt ? new Date(lastFetchedAt).toISOString() : undefined,
    lastFetchErrorAt: lastFetchErrorAt ? new Date(lastFetchErrorAt).toISOString() : undefined,
  };
}

export function resetAccountHealthForTest(): void {
  availability = "unavailable";
  unavailableReason = "not_connected";
  reachoutTimeLock = undefined;
  newChatCap = undefined;
  lastFetchedAt = 0;
  lastFetchErrorAt = 0;
}
