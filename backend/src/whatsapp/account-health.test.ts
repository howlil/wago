import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AccountHealthFetcher,
  checkAccountHealth,
  getAccountHealthSnapshot,
  invalidateAccountHealth,
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

  it("starts unavailable before a connected-session fetch", () => {
    resetAccountHealthForTest();

    expect(getAccountHealthSnapshot()).toMatchObject({
      availability: "unavailable",
      unavailableReason: "not_connected",
    });
  });

  it("becomes available after a successful forced refresh", async () => {
    resetAccountHealthForTest();

    await refreshAccountHealth(
      makeFetcher({
        fetchAccountReachoutTimelock: vi.fn(async () => ({ isActive: false })),
        fetchNewChatMessageCap: vi.fn(async () => ({ capping_status: "NONE" })),
      }),
      { force: true },
    );

    expect(getAccountHealthSnapshot()).toMatchObject({
      availability: "available",
      unavailableReason: undefined,
    });
  });

  it("clears stale restriction fields when the session disconnects", async () => {
    await refreshAccountHealth(
      makeFetcher({
        fetchAccountReachoutTimelock: vi.fn(async () => ({ isActive: true })),
        fetchNewChatMessageCap: vi.fn(async () => ({ capping_status: "CAPPED", total_quota: 250 })),
      }),
      { force: true },
    );

    invalidateAccountHealth("not_connected");

    expect(getAccountHealthSnapshot()).toMatchObject({
      availability: "unavailable",
      unavailableReason: "not_connected",
      reachoutTimeLock: undefined,
      newChatCap: undefined,
      lastFetchedAt: undefined,
      lastFetchErrorAt: undefined,
    });
  });

  it("ignores an in-flight health refresh that resolves after session invalidation", async () => {
    let resolveReachout!: (value: { isActive: boolean } | undefined) => void;
    let resolveCap!: (value: { capping_status: string } | undefined) => void;
    const reachout = new Promise<{ isActive: boolean } | undefined>((resolve) => {
      resolveReachout = resolve;
    });
    const cap = new Promise<{ capping_status: string } | undefined>((resolve) => {
      resolveCap = resolve;
    });

    const refresh = refreshAccountHealth(
      makeFetcher({
        fetchAccountReachoutTimelock: vi.fn(() => reachout),
        fetchNewChatMessageCap: vi.fn(() => cap),
      }),
      { force: true },
    );

    expect(getAccountHealthSnapshot().availability).toBe("checking");
    invalidateAccountHealth("session_invalid");
    resolveReachout({ isActive: false });
    resolveCap({ capping_status: "NONE" });
    await refresh;

    expect(getAccountHealthSnapshot()).toMatchObject({
      availability: "unavailable",
      unavailableReason: "session_invalid",
      reachoutTimeLock: undefined,
      newChatCap: undefined,
    });
  });

  it("blocks new recipients when reachout timelock is active", async () => {
    const retryAt = new Date(Date.now() + 60_000);
    const fetcher = makeFetcher({
      fetchAccountReachoutTimelock: vi.fn(async () => ({
        isActive: true,
        timeEnforcementEnds: retryAt,
        enforcementType: "WEB_COMPANION_ONLY",
      })),
    });

    const decision = await checkAccountHealth(fetcher, { isNewRecipient: true });

    expect(decision).toEqual({
      allowed: false,
      reason: "WA_REACHOUT_RESTRICTED",
      message: "WhatsApp reports this account is restricted from starting new outbound reach-outs",
      retryAt,
    });
  });

  it("allows known recipients while reachout timelock is active", async () => {
    const retryAt = new Date(Date.now() + 60_000);
    updateReachoutTimeLock({
      isActive: true,
      timeEnforcementEnds: retryAt,
    });

    await expect(checkAccountHealth(undefined, { isNewRecipient: false })).resolves.toEqual({ allowed: true });
    expect(getAccountHealthSnapshot().reachoutTimeLock?.isActive).toBe(true);
  });

  it("uses connection.update reachoutTimeLock state for new recipients", async () => {
    const retryAt = new Date(Date.now() + 60_000);
    updateReachoutTimeLock({
      isActive: true,
      timeEnforcementEnds: retryAt,
    });

    const decision = await checkAccountHealth(undefined, { isNewRecipient: true });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toBe("WA_REACHOUT_RESTRICTED");
      expect(decision.retryAt).toBe(retryAt);
    }
  });

  it("blocks only new recipients when the new-chat cap is reached", async () => {
    const fetcher = makeFetcher({
      fetchNewChatMessageCap: vi.fn(async () => ({
        capping_status: "CAPPED",
      })),
    });

    await expect(checkAccountHealth(fetcher, { isNewRecipient: true })).resolves.toEqual({
      allowed: false,
      reason: "WA_NEW_CHAT_CAPPED",
      message: "WhatsApp reports this account has reached its new-chat cap",
    });
    await expect(checkAccountHealth(fetcher, { isNewRecipient: false })).resolves.toEqual({ allowed: true });
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

  it("expires reachout timelock before evaluating outbound policy", async () => {
    const retryAt = new Date(Date.now() - 1_000);
    updateReachoutTimeLock({
      isActive: true,
      timeEnforcementEnds: retryAt,
    });

    await expect(checkAccountHealth(undefined, { isNewRecipient: true })).resolves.toEqual({ allowed: true });
    expect(getAccountHealthSnapshot().reachoutTimeLock?.isActive).toBe(false);
  });

  it("does not repeatedly fetch account health while cache is fresh", async () => {
    const fetcher = makeFetcher();

    await refreshAccountHealth(fetcher);
    await refreshAccountHealth(fetcher);

    expect(fetcher.fetchAccountReachoutTimelock).toHaveBeenCalledTimes(1);
    expect(fetcher.fetchNewChatMessageCap).toHaveBeenCalledTimes(1);
  });

  it("fails open for policy but marks operator health unavailable after fetch errors", async () => {
    const fetcher = makeFetcher({
      fetchAccountReachoutTimelock: vi.fn(async () => {
        throw new Error("boom");
      }),
    });

    const decision = await checkAccountHealth(fetcher, { isNewRecipient: true });

    expect(decision).toEqual({ allowed: true });
    expect(getAccountHealthSnapshot()).toMatchObject({
      availability: "unavailable",
      unavailableReason: "fetch_failed",
    });
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
