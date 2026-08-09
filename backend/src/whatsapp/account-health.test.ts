import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AccountHealthFetcher,
  checkAccountHealth,
  getAccountHealthSnapshot,
  markReachoutRestricted,
  refreshAccountHealth,
  resetAccountHealthForTest,
  updateReachoutTimeLock,
} from "./account-health.js";

function makeFetcher(overrides: Partial<AccountHealthFetcher> = {}): AccountHealthFetcher {
  return {
    fetchAccountReachoutTimelock: vi.fn(async () => undefined),
    fetchNewChatMessageCap: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("account health", () => {
  afterEach(() => {
    resetAccountHealthForTest();
    vi.useRealTimers();
  });

  it("blocks outbound when reachout timelock is active", async () => {
    const retryAt = new Date(Date.now() + 60_000);
    const fetcher = makeFetcher({
      fetchAccountReachoutTimelock: vi.fn(async () => ({
        isActive: true,
        timeEnforcementEnds: retryAt,
        enforcementType: "WEB_COMPANION_ONLY",
      })),
    });

    const decision = await checkAccountHealth(fetcher, { isNewRecipient: false });

    expect(decision).toEqual({
      allowed: false,
      reason: "WA_REACHOUT_RESTRICTED",
      message: "WhatsApp reports this account is restricted from starting outbound reach-outs",
      retryAt,
    });
  });

  it("uses connection.update reachoutTimeLock state immediately", async () => {
    const retryAt = new Date(Date.now() + 60_000);
    updateReachoutTimeLock({
      isActive: true,
      timeEnforcementEnds: retryAt,
    });

    const decision = await checkAccountHealth(undefined, { isNewRecipient: false });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toBe("WA_REACHOUT_RESTRICTED");
      expect(decision.retryAt).toBe(retryAt);
    }
  });

  it("blocks new-chat capped accounts", async () => {
    const fetcher = makeFetcher({
      fetchNewChatMessageCap: vi.fn(async () => ({
        capping_status: "CAPPED",
      })),
    });

    const decision = await checkAccountHealth(fetcher, { isNewRecipient: false });

    expect(decision).toEqual({
      allowed: false,
      reason: "WA_NEW_CHAT_CAPPED",
      message: "WhatsApp reports this account has reached its new-chat cap",
    });
  });

  it("blocks new recipients on new-chat warning but allows known recipients", async () => {
    const fetcher = makeFetcher({
      fetchNewChatMessageCap: vi.fn(async () => ({
        capping_status: "FIRST_WARNING",
      })),
    });

    await expect(checkAccountHealth(fetcher, { isNewRecipient: true })).resolves.toEqual({
      allowed: false,
      reason: "NEW_CHAT_RATE_LIMITED",
      message: "WhatsApp reports a new-chat warning, so new recipient sends are paused",
    });
    await expect(checkAccountHealth(fetcher, { isNewRecipient: false })).resolves.toEqual({ allowed: true });
  });

  it("does not repeatedly fetch account health while cache is fresh", async () => {
    const fetcher = makeFetcher();

    await refreshAccountHealth(fetcher);
    await refreshAccountHealth(fetcher);

    expect(fetcher.fetchAccountReachoutTimelock).toHaveBeenCalledTimes(1);
    expect(fetcher.fetchNewChatMessageCap).toHaveBeenCalledTimes(1);
  });

  it("fails open and records fetch errors", async () => {
    const fetcher = makeFetcher({
      fetchAccountReachoutTimelock: vi.fn(async () => {
        throw new Error("boom");
      }),
    });

    const decision = await checkAccountHealth(fetcher, { isNewRecipient: true });

    expect(decision).toEqual({ allowed: true });
    expect(getAccountHealthSnapshot().lastFetchErrorAt).toBeDefined();
  });

  it("marks reachout restriction with fallback retry time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T00:00:00.000Z"));

    markReachoutRestricted();

    expect(getAccountHealthSnapshot().reachoutTimeLock).toEqual({
      isActive: true,
      retryAt: "2026-08-09T00:30:00.000Z",
      enforcementType: "UNKNOWN",
    });
  });
});
