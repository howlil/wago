import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { migrations, runMigrations } from "../infrastructure/database/migrations.js";
import { createWebhookSettingsStore } from "./settings-store.js";

const legacySecret = "a".repeat(32);
const previousLegacySecret = "b".repeat(32);

describe("webhook settings store", () => {
  let database: DatabaseSync;

  beforeEach(() => {
    database = new DatabaseSync(":memory:");
    database.exec("PRAGMA foreign_keys = ON");
    runMigrations(database, migrations);
  });

  it("imports valid legacy env settings only when persisted settings are empty", () => {
    const store = createWebhookSettingsStore(database);

    const imported = store.importLegacyIfEmpty({
      enabled: true,
      url: "https://legacy.example.test/webhook",
      secret: legacySecret,
      previousSecret: previousLegacySecret,
    });

    expect(imported).toMatchObject({
      enabled: true,
      url: "https://legacy.example.test/webhook",
      secret: legacySecret,
      previousSecret: previousLegacySecret,
    });

    store.importLegacyIfEmpty({
      enabled: true,
      url: "https://ignored.example.test/webhook",
      secret: "c".repeat(32),
      previousSecret: null,
    });

    expect(store.get()).toMatchObject({
      url: "https://legacy.example.test/webhook",
      secret: legacySecret,
    });
  });

  it("generates a signing secret on first enable and keeps it when only URL changes", () => {
    const store = createWebhookSettingsStore(database);

    const first = store.save({ enabled: true, url: "https://receiver.example.test/webhook" });
    expect(first.generatedSecret).toBeTruthy();
    expect(first.generatedSecret?.length).toBeGreaterThanOrEqual(43);

    const second = store.save({ enabled: true, url: "https://receiver.example.test/v2/webhook" });
    expect(second.generatedSecret).toBeUndefined();
    expect(second.settings.secret).toBe(first.settings.secret);
    expect(second.settings.url).toBe("https://receiver.example.test/v2/webhook");
  });

  it("keeps callback URL and signing secret when delivery is disabled", () => {
    const store = createWebhookSettingsStore(database);
    const configured = store.save({ enabled: true, url: "https://receiver.example.test/webhook" });

    const disabled = store.save({ enabled: false });

    expect(disabled.generatedSecret).toBeUndefined();
    expect(disabled.settings).toMatchObject({
      enabled: false,
      url: "https://receiver.example.test/webhook",
      secret: configured.settings.secret,
    });
  });

  it("rotates with a previous-secret overlap and can complete rotation", () => {
    const store = createWebhookSettingsStore(database);
    const initial = store.save({ enabled: true, url: "https://receiver.example.test/webhook" });

    const rotated = store.rotateSecret();
    expect(rotated.generatedSecret).toBeTruthy();
    expect(rotated.generatedSecret).not.toBe(initial.generatedSecret);
    expect(rotated.settings.previousSecret).toBe(initial.settings.secret);
    expect(rotated.settings.secret).toBe(rotated.generatedSecret);

    const completed = store.completeRotation();
    expect(completed.previousSecret).toBeNull();
    expect(completed.secret).toBe(rotated.generatedSecret);
  });

  it("rejects unsafe webhook callback URLs", () => {
    const store = createWebhookSettingsStore(database);

    expect(() => store.save({ enabled: true, url: "ftp://receiver.example.test/webhook" })).toThrow(
      "Webhook URL must use http or https",
    );
    expect(() => store.save({ enabled: true, url: "https://user:pass@receiver.example.test/webhook" })).toThrow(
      "Webhook URL must not contain embedded credentials",
    );
  });
});
