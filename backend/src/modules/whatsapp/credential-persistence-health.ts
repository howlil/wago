export type CredentialPersistenceHealth = {
  status: "unknown" | "healthy" | "degraded";
  consecutiveFailures: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
};

let health: CredentialPersistenceHealth = {
  status: "unknown",
  consecutiveFailures: 0,
  lastSuccessAt: null,
  lastFailureAt: null,
};

export function getCredentialPersistenceHealth(): CredentialPersistenceHealth {
  return { ...health };
}

export function markCredentialPersistenceSuccess(now = Date.now()): void {
  health = {
    status: "healthy",
    consecutiveFailures: 0,
    lastSuccessAt: new Date(now).toISOString(),
    lastFailureAt: health.lastFailureAt,
  };
}

export function markCredentialPersistenceFailure(now = Date.now()): void {
  health = {
    status: "degraded",
    consecutiveFailures: health.consecutiveFailures + 1,
    lastSuccessAt: health.lastSuccessAt,
    lastFailureAt: new Date(now).toISOString(),
  };
}

export function resetCredentialPersistenceHealthForTest(): void {
  health = {
    status: "unknown",
    consecutiveFailures: 0,
    lastSuccessAt: null,
    lastFailureAt: null,
  };
}
