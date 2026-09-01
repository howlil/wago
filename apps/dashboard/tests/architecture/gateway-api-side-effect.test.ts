import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  window.sessionStorage.clear();
  vi.resetModules();
});

describe("gateway API module side effects", () => {
  it("keeps API imports passive with respect to browser storage", async () => {
    window.sessionStorage.setItem("unrelated", "preserve-me");
    const storageEntriesBefore = window.sessionStorage.length;

    await import("../../src/features/gateway/api.js");

    expect(window.sessionStorage.length).toBe(storageEntriesBefore);
    expect(window.sessionStorage.getItem("unrelated")).toBe("preserve-me");
  });
});
