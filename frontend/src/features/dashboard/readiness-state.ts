import type { GatewayReadinessSnapshot } from "../gateway/api.js";

export type { GatewayReadinessSnapshot } from "../gateway/api.js";

export type OperationalReadinessWarning = {
  tone: "warning" | "danger";
  message: string;
  auditHref: string;
};

function auditHref(status: GatewayReadinessSnapshot["status"], reason?: string): string {
  if (reason === "bound_session_disconnected") {
    return "/audit?category=connection&level=warning";
  }
  if (reason === "credential_persistence_failed") {
    return "/audit?category=system&level=warning";
  }
  if (
    reason === "persistent_storage_unavailable" ||
    reason === "instance_ownership_lost" ||
    reason === "database_unavailable"
  ) {
    return "/audit?category=system&level=error";
  }
  return status === "not_ready" ? "/audit?level=error" : "/audit?level=warning";
}

export function getOperationalReadinessWarning(
  snapshot: GatewayReadinessSnapshot | null,
): OperationalReadinessWarning | null {
  if (!snapshot || snapshot.status === "ok") return null;

  const failingCheck = Object.values(snapshot.checks).find((check) => check.status === snapshot.status);
  const reason = failingCheck?.reason;
  const targetAuditHref = auditHref(snapshot.status, reason);

  if (snapshot.status === "not_ready") {
    if (reason === "persistent_storage_unavailable") {
      return {
        tone: "danger",
        message: "Persistent /app/data storage is unavailable. Restore the durable mount before restarting Wago.",
        auditHref: targetAuditHref,
      };
    }
    if (reason === "instance_ownership_lost") {
      return {
        tone: "danger",
        message:
          "This process lost single-instance ownership. Stop duplicate Wago replicas and restart only one owner.",
        auditHref: targetAuditHref,
      };
    }
    if (reason === "database_unavailable") {
      return {
        tone: "danger",
        message: "Wago cannot read its SQLite state. Check /app/data filesystem and database access before restarting.",
        auditHref: targetAuditHref,
      };
    }

    return {
      tone: "danger",
      message: "The gateway control plane is not ready. Review recent error events before restarting.",
      auditHref: targetAuditHref,
    };
  }

  if (reason === "credential_persistence_failed") {
    return {
      tone: "warning",
      message: "WhatsApp credential updates are not persisting. Check /app/data filesystem health before any restart.",
      auditHref: targetAuditHref,
    };
  }
  if (reason === "bound_session_disconnected") {
    return {
      tone: "warning",
      message: "The bound WhatsApp session is disconnected. Inspect connection events; rebind only if the session is invalid.",
      auditHref: targetAuditHref,
    };
  }

  return {
    tone: "warning",
    message: "Wago is running in a degraded state. Review recent warning events for the recovery action.",
    auditHref: targetAuditHref,
  };
}
