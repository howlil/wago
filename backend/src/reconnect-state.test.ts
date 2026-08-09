import { describe, expect, it } from "vitest";
import {
  getReconnectDelayMs,
  nextReconnectAttempt,
  resetReconnectAttempts,
  shouldScheduleReconnect
} from "./reconnect-state.js";

describe("reconnect state", () => {
  it("uses bounded backoff delays with deterministic jitter", () => {
    expect(getReconnectDelayMs(0, () => 0.5)).toBe(2000);
    expect(getReconnectDelayMs(1, () => 0.5)).toBe(5000);
    expect(getReconnectDelayMs(2, () => 0.5)).toBe(15000);
    expect(getReconnectDelayMs(3, () => 0.5)).toBe(30000);
    expect(getReconnectDelayMs(4, () => 0.5)).toBe(60000);
    expect(getReconnectDelayMs(99, () => 0.5)).toBe(60000);
  });

  it("adds bounded jitter around the base delay", () => {
    expect(getReconnectDelayMs(0, () => 0)).toBe(1600);
    expect(getReconnectDelayMs(0, () => 1)).toBe(2400);
  });

  it("does not reconnect during logout, rebind, or shutdown", () => {
    expect(shouldScheduleReconnect({ loggedOut: false, rebindInProgress: false, shuttingDown: false })).toBe(true);
    expect(shouldScheduleReconnect({ loggedOut: true, rebindInProgress: false, shuttingDown: false })).toBe(false);
    expect(shouldScheduleReconnect({ loggedOut: false, rebindInProgress: true, shuttingDown: false })).toBe(false);
    expect(shouldScheduleReconnect({ loggedOut: false, rebindInProgress: false, shuttingDown: true })).toBe(false);
  });

  it("increments and resets attempts explicitly", () => {
    expect(nextReconnectAttempt(0)).toBe(1);
    expect(resetReconnectAttempts()).toBe(0);
  });
});
