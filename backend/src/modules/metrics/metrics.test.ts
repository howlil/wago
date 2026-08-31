import { describe, expect, it } from "vitest";
import { renderOperationalMetrics } from "./metrics.js";

describe("operational metrics exposition", () => {
  it("renders bounded low-cardinality Prometheus gauges", () => {
    const output = renderOperationalMetrics({
      uptimeSeconds: 12.5,
      readiness: "degraded",
      whatsapp: "connected",
      messagesByStatus: { pending: 2, accepted: 7, rejected: 1 },
      pendingByDispatchState: { submitted: 1, indeterminate: 1 },
      webhooksByStatus: { pending: 3, delivered: 5, failed: 1 },
      activeIdempotencyReservations: 4,
    });

    expect(output).toContain("wago_process_uptime_seconds 12.5");
    expect(output).toContain('wago_gateway_readiness{status="degraded"} 1');
    expect(output).toContain('wago_gateway_readiness{status="ok"} 0');
    expect(output).toContain('wago_whatsapp_connection{status="connected"} 1');
    expect(output).toContain('wago_outbound_messages_retained{status="accepted"} 7');
    expect(output).toContain('wago_outbound_pending_dispatch{state="indeterminate"} 1');
    expect(output).toContain('wago_webhook_deliveries_retained{status="delivered"} 5');
    expect(output).toContain("wago_idempotency_reservations_active 4");
    expect(output).not.toContain("messageId");
    expect(output).not.toContain("recipient");
  });
});
