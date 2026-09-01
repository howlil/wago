import { getDatabase } from "../../infrastructure/database.js";
import { getReadinessSnapshot } from "../gateway/readiness.js";
import { getConnectionStatus, type WhatsAppStatus } from "../whatsapp/connection-state.js";

const database = getDatabase();
const startedAt = Date.now();

const MESSAGE_STATUSES = ["pending", "accepted", "rejected"] as const;
const DISPATCH_STATES = ["prepared", "submitting", "submitted", "indeterminate"] as const;
const WEBHOOK_STATUSES = ["pending", "delivering", "delivered", "failed", "expired"] as const;
const READINESS_STATUSES = ["ok", "degraded", "not_ready"] as const;
const WHATSAPP_STATUSES: WhatsAppStatus[] = ["connecting", "qr", "connected", "disconnected"];

type CountRow = { key: string; count: number };

export type OperationalMetricsSnapshot = {
  uptimeSeconds: number;
  readiness: string;
  whatsapp: WhatsAppStatus;
  messagesByStatus: Record<string, number>;
  pendingByDispatchState: Record<string, number>;
  webhooksByStatus: Record<string, number>;
  activeIdempotencyReservations: number;
};

function groupedCount(sql: string): Record<string, number> {
  const rows = database.prepare(sql).all() as CountRow[];
  return Object.fromEntries(rows.map((row) => [row.key, Number(row.count)]));
}

export function collectOperationalMetrics(now = Date.now()): OperationalMetricsSnapshot {
  const readiness = getReadinessSnapshot();
  const activeReservationRow = database
    .prepare("SELECT COUNT(*) AS count FROM idempotency_keys WHERE expires_at > ?")
    .get(now) as { count?: number } | undefined;

  return {
    uptimeSeconds: Math.max(0, (now - startedAt) / 1000),
    readiness: readiness.status,
    whatsapp: getConnectionStatus(),
    messagesByStatus: groupedCount("SELECT status AS key, COUNT(*) AS count FROM outbound_messages GROUP BY status"),
    pendingByDispatchState: groupedCount(
      "SELECT dispatch_state AS key, COUNT(*) AS count FROM outbound_messages WHERE status = 'pending' GROUP BY dispatch_state",
    ),
    webhooksByStatus: groupedCount("SELECT status AS key, COUNT(*) AS count FROM webhook_deliveries GROUP BY status"),
    activeIdempotencyReservations: Number(activeReservationRow?.count ?? 0),
  };
}

function sample(name: string, labels: Record<string, string>, value: number): string {
  const labelText = Object.entries(labels)
    .map(([key, label]) => `${key}="${label}"`)
    .join(",");
  return `${name}${labelText ? `{${labelText}}` : ""} ${value}`;
}

export function renderOperationalMetrics(snapshot: OperationalMetricsSnapshot): string {
  const lines = [
    "# HELP wago_process_uptime_seconds Seconds since the Wago process started.",
    "# TYPE wago_process_uptime_seconds gauge",
    sample("wago_process_uptime_seconds", {}, snapshot.uptimeSeconds),
    "# HELP wago_gateway_readiness Current gateway readiness as a one-hot gauge.",
    "# TYPE wago_gateway_readiness gauge",
    ...READINESS_STATUSES.map((status) =>
      sample("wago_gateway_readiness", { status }, snapshot.readiness === status ? 1 : 0),
    ),
    "# HELP wago_whatsapp_connection Current WhatsApp connection state as a one-hot gauge.",
    "# TYPE wago_whatsapp_connection gauge",
    ...WHATSAPP_STATUSES.map((status) =>
      sample("wago_whatsapp_connection", { status }, snapshot.whatsapp === status ? 1 : 0),
    ),
    "# HELP wago_outbound_messages_retained Retained outbound diagnostic records by delivery status.",
    "# TYPE wago_outbound_messages_retained gauge",
    ...MESSAGE_STATUSES.map((status) =>
      sample("wago_outbound_messages_retained", { status }, snapshot.messagesByStatus[status] ?? 0),
    ),
    "# HELP wago_outbound_pending_dispatch Retained pending outbound records by transport state.",
    "# TYPE wago_outbound_pending_dispatch gauge",
    ...DISPATCH_STATES.map((state) =>
      sample("wago_outbound_pending_dispatch", { state }, snapshot.pendingByDispatchState[state] ?? 0),
    ),
    "# HELP wago_webhook_deliveries_retained Retained webhook deliveries by state.",
    "# TYPE wago_webhook_deliveries_retained gauge",
    ...WEBHOOK_STATUSES.map((status) =>
      sample("wago_webhook_deliveries_retained", { status }, snapshot.webhooksByStatus[status] ?? 0),
    ),
    "# HELP wago_idempotency_reservations_active Active outbound idempotency reservations.",
    "# TYPE wago_idempotency_reservations_active gauge",
    sample("wago_idempotency_reservations_active", {}, snapshot.activeIdempotencyReservations),
  ];

  return `${lines.join("\n")}\n`;
}
