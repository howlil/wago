import { beforeEach, describe, expect, it } from "vitest";
import {
  getCredentialPersistenceHealth,
  markCredentialPersistenceFailure,
  markCredentialPersistenceSuccess,
  resetCredentialPersistenceHealthForTest,
} from "./credential-persistence-health.js";

describe("credential persistence health", () => {
  beforeEach(() => resetCredentialPersistenceHealthForTest());

  it("starts unknown and becomes degraded after persistence failures", () => {
    expect(getCredentialPersistenceHealth()).toEqual({
      status: "unknown",
      consecutiveFailures: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
    });

    markCredentialPersistenceFailure(Date.UTC(2026, 7, 14, 10, 0, 0));
    markCredentialPersistenceFailure(Date.UTC(2026, 7, 14, 10, 1, 0));

    expect(getCredentialPersistenceHealth()).toMatchObject({
      status: "degraded",
      consecutiveFailures: 2,
      lastFailureAt: "2026-08-14T10:01:00.000Z",
    });
  });

  it("recovers after a successful credential write", () => {
    markCredentialPersistenceFailure(Date.UTC(2026, 7, 14, 10, 0, 0));
    markCredentialPersistenceSuccess(Date.UTC(2026, 7, 14, 10, 2, 0));

    expect(getCredentialPersistenceHealth()).toEqual({
      status: "healthy",
      consecutiveFailures: 0,
      lastSuccessAt: "2026-08-14T10:02:00.000Z",
      lastFailureAt: "2026-08-14T10:00:00.000Z",
    });
  });
});
