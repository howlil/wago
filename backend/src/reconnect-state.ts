const BACKOFF_DELAYS_MS = [2000, 5000, 15000, 30000, 60000] as const;
const JITTER_RATIO = 0.2;

export function getReconnectDelayMs(attempt: number, random = Math.random): number {
  const baseDelay = BACKOFF_DELAYS_MS[Math.min(Math.max(attempt, 0), BACKOFF_DELAYS_MS.length - 1)]!;
  const jitterRange = baseDelay * JITTER_RATIO;
  const jitter = Math.floor((random() * 2 - 1) * jitterRange);

  return Math.max(0, baseDelay + jitter);
}

export function shouldScheduleReconnect(input: {
  loggedOut: boolean;
  rebindInProgress: boolean;
  shuttingDown: boolean;
}): boolean {
  return !input.loggedOut && !input.rebindInProgress && !input.shuttingDown;
}

export function resetReconnectAttempts(): number {
  return 0;
}

export function nextReconnectAttempt(currentAttempt: number): number {
  return currentAttempt + 1;
}
