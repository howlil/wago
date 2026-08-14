import { config } from "../../config/index.js";
import { getRuntimeDataMountInspection } from "../../infrastructure/data-mount.js";
import { getDatabase } from "../../infrastructure/database.js";
import { getRuntimeInstanceLeaseState, type InstanceLeaseState } from "../../infrastructure/instance-lease.js";
import { getWhatsAppStatusSnapshot, type WhatsAppStatusSnapshot } from "../../whatsapp/connection-state.js";
import {
  type CredentialPersistenceHealth,
  getCredentialPersistenceHealth,
} from "../../whatsapp/credential-persistence-health.js";
import { webhookSettingsStore } from "../../webhooks/settings-runtime.js";
import { getAccessSnapshot } from "../access/api-key.js";

export type ReadinessLevel = "ok" | "degraded" | "not_ready";
export type ReadinessCheck = { status: ReadinessLevel; reason?: string };
export type ReadinessSnapshot = {
  status: ReadinessLevel;
  appId: string;
  apiKeyConfigured: boolean;
  webhookConfigured: boolean;
  checks: {
    storage: ReadinessCheck;
    database: ReadinessCheck;
    instanceLease: ReadinessCheck;
    credentialPersistence: ReadinessCheck;
    apiKey: ReadinessCheck;
    webhook: ReadinessCheck;
    whatsapp: ReadinessCheck;
  };
};

type ReadinessOverrides = {
  storage?: ReadinessCheck;
  database?: ReadinessCheck;
  instanceLeaseState?: InstanceLeaseState;
  credentialPersistence?: CredentialPersistenceHealth;
  whatsapp?: WhatsAppStatusSnapshot;
};

const database = getDatabase();

function worstStatus(checks: ReadinessCheck[]): ReadinessLevel {
  if (checks.some((check) => check.status === "not_ready")) return "not_ready";
  if (checks.some((check) => check.status === "degraded")) return "degraded";
  return "ok";
}

function storageCheck(): ReadinessCheck {
  if (config.nodeEnv !== "production") return { status: "ok", reason: "development_storage_policy" };
  return getRuntimeDataMountInspection()?.persistent
    ? { status: "ok" }
    : { status: "not_ready", reason: "persistent_storage_unavailable" };
}

function databaseCheck(): ReadinessCheck {
  try {
    database.prepare("SELECT 1 AS ok").get();
    return { status: "ok" };
  } catch {
    return { status: "not_ready", reason: "database_unavailable" };
  }
}

function leaseCheck(state: InstanceLeaseState): ReadinessCheck {
  if (state === "lost" || state === "released") return { status: "not_ready", reason: "instance_ownership_lost" };
  return state === "owned" ? { status: "ok" } : { status: "ok", reason: "instance_ownership_not_started" };
}

function credentialCheck(health: CredentialPersistenceHealth): ReadinessCheck {
  if (health.status === "degraded") return { status: "degraded", reason: "credential_persistence_failed" };
  return { status: "ok", ...(health.status === "unknown" ? { reason: "no_credential_write_observed" } : {}) };
}

function whatsappCheck(snapshot: WhatsAppStatusSnapshot): ReadinessCheck {
  if (snapshot.binding.state === "bound" && snapshot.status === "disconnected") {
    return { status: "degraded", reason: "bound_session_disconnected" };
  }
  return { status: "ok", ...(snapshot.binding.state === "unbound" ? { reason: "pairing_not_completed" } : {}) };
}

export function getReadinessSnapshot(overrides: ReadinessOverrides = {}): ReadinessSnapshot {
  const webhookSettings = webhookSettingsStore.get();
  const access = getAccessSnapshot();
  const webhookConfigured = Boolean(webhookSettings?.enabled && webhookSettings.url && webhookSettings.secret);
  const checks = {
    storage: overrides.storage ?? storageCheck(),
    database: overrides.database ?? databaseCheck(),
    instanceLease: leaseCheck(overrides.instanceLeaseState ?? getRuntimeInstanceLeaseState()),
    credentialPersistence: credentialCheck(overrides.credentialPersistence ?? getCredentialPersistenceHealth()),
    apiKey: access.apiKeyConfigured ? { status: "ok" as const } : { status: "ok" as const, reason: "setup_required" },
    webhook: webhookConfigured ? { status: "ok" as const } : { status: "ok" as const, reason: "webhook_not_enabled" },
    whatsapp: whatsappCheck(overrides.whatsapp ?? getWhatsAppStatusSnapshot()),
  };

  return {
    status: worstStatus(Object.values(checks)),
    appId: access.appId,
    apiKeyConfigured: access.apiKeyConfigured,
    webhookConfigured,
    checks,
  };
}
