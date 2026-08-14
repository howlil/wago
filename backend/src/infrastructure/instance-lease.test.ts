import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { runMigrations } from "./database/migrations.js";
import { createInstanceLeaseManager } from "./instance-lease.js";

const databases: DatabaseSync[] = [];

function createDatabase(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  runMigrations(database);
  databases.push(database);
  return database;
}

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

describe("gateway instance lease", () => {
  it("allows only one unexpired owner", () => {
    const database = createDatabase();
    let now = 1_000;
    const first = createInstanceLeaseManager(database, { ownerId: "first", now: () => now });
    const second = createInstanceLeaseManager(database, { ownerId: "second", now: () => now });

    expect(first.acquire()).toEqual({ acquired: true });
    expect(second.acquire()).toEqual({ acquired: false, reason: "LEASE_HELD" });

    now += 15_001;
    expect(second.acquire()).toEqual({ acquired: true });
    expect(first.isOwner()).toBe(false);
  });

  it("extends the lease only for the current owner", () => {
    const database = createDatabase();
    let now = 5_000;
    const owner = createInstanceLeaseManager(database, { ownerId: "owner", now: () => now });
    const other = createInstanceLeaseManager(database, { ownerId: "other", now: () => now });

    expect(owner.acquire()).toEqual({ acquired: true });
    now += 5_000;
    expect(owner.heartbeat()).toBe(true);
    expect(other.heartbeat()).toBe(false);

    now += 10_001;
    expect(owner.isOwner()).toBe(true);
  });

  it("releases ownership for immediate takeover", () => {
    const database = createDatabase();
    const first = createInstanceLeaseManager(database, { ownerId: "first" });
    const second = createInstanceLeaseManager(database, { ownerId: "second" });

    expect(first.acquire()).toEqual({ acquired: true });
    expect(first.release()).toBe(true);
    expect(second.acquire()).toEqual({ acquired: true });
  });
});
