const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export type ReadinessLevel = "ok" | "degraded" | "not_ready";
export type ReadinessCheck = {
  status: ReadinessLevel;
  reason?: string;
};

export type GatewayReadinessSnapshot = {
  status: ReadinessLevel;
  checks: Record<string, ReadinessCheck>;
};

export type OperationalReadinessWarning = {
  tone: "warning" | "danger";
  message: string;
};

export async function fetchGatewayReadiness(): Promise<GatewayReadinessSnapshot> {
  const response = await fetch(`${API_BASE_URL}/ready`, { credentials: "include" });
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new Error("Readiness endpoint returned a non-JSON response");
  }

  const snapshot = (await response.json()) as GatewayReadinessSnapshot;
  if (!response.ok && response.status !== 503) {
    throw new Error("Readiness endpoint failed");
  }

  return snapshot;
}

export function getOperationalReadinessWarning(
  snapshot: GatewayReadinessSnapshot | null,
): OperationalReadinessWarning | null {
  if (!snapshot || snapshot.status === "ok") return null;

  const failingCheck = Object.values(snapshot.checks).find((check) => check.status === snapshot.status);
  const reason = failingCheck?.reason;

  if (snapshot.status === "not_ready") {
    if (reason === "persistent_storage_unavailable") {
      return {
        tone: "danger",
        message: "Persistent /app/data storage is unavailable. Restore the durable mount before restarting Wago.",
      };
    }
    if (reason === "instance_ownership_lost") {
      return {
        tone: "danger",
        message: "This process lost single-instance ownership. Stop duplicate Wago replicas and restart only one owner.",
      };
    }
    if (reason === "database_unavailable") {
      return {
        tone: "danger",
        message: "Wago cannot read its SQLite state. Check /app/data filesystem and database access before restarting.",
      };
    }

    return {
      tone: "danger",
      message: "The gateway control plane is not ready. Check /ready and container logs before restarting.",
    };
  }

  if (reason === "credential_persistence_failed") {
    return {
      tone: "warning",
      message: "WhatsApp credential updates are not persisting. Check /app/data filesystem health before any restart.",
    };
  }
  if (reason === "bound_session_disconnected") {
    return {
      tone: "warning",
      message: "The bound WhatsApp session is disconnected. Inspect Audit first; rebind only if the session is invalid.",
    };
  }

  return {
    tone: "warning",
    message: "Wago is running in a degraded state. Check /ready and Audit for the recovery action.",
  };
}
