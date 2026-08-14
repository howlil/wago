import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { withTransaction } from "./database/transaction.js";

export const INSTANCE_ALREADY_ACTIVE_CODE = "WAGO_INSTANCE_ALREADY_ACTIVE";

export class WagoInstanceAlreadyActiveError extends Error {
  readonly code = INSTANCE_ALREADY_ACTIVE_CODE;

  constructor() {
    super(`${INSTANCE_ALREADY_ACTIVE_CODE}: another Wago process already owns this persistent volume`);
    this.name = "WagoInstanceAlreadyActiveError";
  }
}

export type InstanceLeaseResult = { acquired: true } | { acquired: false; reason: "LEASE_HELD" };
export type InstanceLeaseState = "not_acquired" | "owned" | "lost" | "released";

export type InstanceLeaseManager = {
  acquire(): InstanceLeaseResult;
  heartbeat(): boolean;
  release(): boolean;
  isOwner(): boolean;
  startHeartbeat(): void;
  stopHeartbeat(): void;
  getState(): InstanceLeaseState;
};

type LeaseOptions = {
  ownerId?: string;
  ttlMs?: number;
  heartbeatMs?: number;
  now?: () => number;
  onOwnershipLost?: () => void;
  trackRuntimeState?: boolean;
};

let runtimeInstanceLeaseState: InstanceLeaseState = "not_acquired";

export function getRuntimeInstanceLeaseState(): InstanceLeaseState {
  return runtimeInstanceLeaseState;
}

export function resetRuntimeInstanceLeaseStateForTest(): void {
  runtimeInstanceLeaseState = "not_acquired";
}

export function createInstanceLeaseManager(database: DatabaseSync, options: LeaseOptions = {}): InstanceLeaseManager {
  const ownerId = options.ownerId ?? randomUUID();
  const ttlMs = options.ttlMs ?? 15_000;
  const heartbeatMs = options.heartbeatMs ?? 5_000;
  const now = options.now ?? Date.now;
  let timer: NodeJS.Timeout | undefined;
  let state: InstanceLeaseState = "not_acquired";

  const setState = (nextState: InstanceLeaseState): void => {
    state = nextState;
    if (options.trackRuntimeState) runtimeInstanceLeaseState = nextState;
  };

  const readLease = database.prepare("SELECT owner_id, expires_at FROM gateway_instance_lease WHERE id = 1");
  const acquireLease = database.prepare(`
    INSERT INTO gateway_instance_lease (id, owner_id, acquired_at, heartbeat_at, expires_at)
    VALUES (1, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      owner_id = excluded.owner_id,
      acquired_at = excluded.acquired_at,
      heartbeat_at = excluded.heartbeat_at,
      expires_at = excluded.expires_at
  `);
  const heartbeatLease = database.prepare(`
    UPDATE gateway_instance_lease
    SET heartbeat_at = ?, expires_at = ?
    WHERE id = 1 AND owner_id = ? AND expires_at > ?
  `);
  const releaseLease = database.prepare("DELETE FROM gateway_instance_lease WHERE id = 1 AND owner_id = ?");

  const loseOwnership = (): void => {
    if (state === "lost") return;
    setState("lost");
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
    options.onOwnershipLost?.();
  };

  const manager: InstanceLeaseManager = {
    acquire(): InstanceLeaseResult {
      const timestamp = now();
      const expiresAt = timestamp + ttlMs;
      return withTransaction(database, () => {
        const existing = readLease.get() as { owner_id?: string; expires_at?: number } | undefined;
        if (
          existing?.owner_id &&
          existing.owner_id !== ownerId &&
          typeof existing.expires_at === "number" &&
          existing.expires_at > timestamp
        ) {
          setState("not_acquired");
          return { acquired: false, reason: "LEASE_HELD" };
        }
        acquireLease.run(ownerId, timestamp, timestamp, expiresAt);
        setState("owned");
        return { acquired: true };
      });
    },

    heartbeat(): boolean {
      if (state !== "owned") return false;
      const timestamp = now();
      const result = heartbeatLease.run(timestamp, timestamp + ttlMs, ownerId, timestamp);
      if (Number(result.changes) !== 1) {
        loseOwnership();
        return false;
      }
      return true;
    },

    release(): boolean {
      const result = releaseLease.run(ownerId);
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
      setState("released");
      return Number(result.changes) === 1;
    },

    isOwner(): boolean {
      const timestamp = now();
      const existing = readLease.get() as { owner_id?: string; expires_at?: number } | undefined;
      return (
        existing?.owner_id === ownerId && typeof existing.expires_at === "number" && existing.expires_at > timestamp
      );
    },

    startHeartbeat(): void {
      if (timer || state !== "owned") return;
      timer = setInterval(() => manager.heartbeat(), heartbeatMs);
      timer.unref();
    },

    stopHeartbeat(): void {
      if (!timer) return;
      clearInterval(timer);
      timer = undefined;
    },

    getState(): InstanceLeaseState {
      return state;
    },
  };

  return manager;
}
