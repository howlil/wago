import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getWebhookDeliveries, getWebhookDelivery, redeliverWebhookDelivery } from "./api.js";
import { WebhookDeliveryDiagnostics } from "./WebhookDeliveryDiagnostics.js";

vi.mock("./api.js", () => ({
  getWebhookDeliveries: vi.fn(),
  getWebhookDelivery: vi.fn(),
  redeliverWebhookDelivery: vi.fn(),
}));

const delivery = {
  id: "11111111-1111-4111-8111-111111111111",
  event: "message.server_accepted",
  messageId: "message-1",
  status: "failed" as const,
  attemptCount: 2,
  redeliveryCount: 0,
  nextAttemptAt: null,
  firstAttemptAt: "2026-08-31T07:00:00.000Z",
  lastAttemptAt: "2026-08-31T07:01:00.000Z",
  lastStatusCode: 401,
  lastErrorCode: "WEBHOOK_HTTP_CLIENT_ERROR",
  createdAt: "2026-08-31T06:59:00.000Z",
  deliveredAt: null,
  expiresAt: "2026-09-01T06:59:00.000Z",
  claimedAt: null,
  redeliveryAvailable: true,
};

const detail = {
  ...delivery,
  attempts: [
    {
      sequence: 2,
      redeliveryNumber: 0,
      outcome: "permanent_failure" as const,
      startedAt: "2026-08-31T07:01:00.000Z",
      completedAt: "2026-08-31T07:01:01.000Z",
      statusCode: 401,
      errorCode: "WEBHOOK_HTTP_CLIENT_ERROR",
      retryable: false,
      nextAttemptAt: null,
    },
    {
      sequence: 1,
      redeliveryNumber: 0,
      outcome: "retryable_failure" as const,
      startedAt: "2026-08-31T07:00:00.000Z",
      completedAt: "2026-08-31T07:00:01.000Z",
      statusCode: 503,
      errorCode: "WEBHOOK_HTTP_SERVER_ERROR",
      retryable: true,
      nextAttemptAt: "2026-08-31T07:00:06.000Z",
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WebhookDeliveryDiagnostics", () => {
  it("expands retained attempt evidence inline and preserves it through explicit redelivery", async () => {
    vi.mocked(getWebhookDeliveries).mockResolvedValue({ success: true, deliveries: [delivery] });
    vi.mocked(getWebhookDelivery).mockResolvedValue({ success: true, delivery: detail });
    vi.mocked(redeliverWebhookDelivery).mockResolvedValue({
      success: true,
      delivery: { ...delivery, status: "pending", attemptCount: 0, redeliveryCount: 1 },
    });

    const user = userEvent.setup();
    render(<WebhookDeliveryDiagnostics />);

    expect(await screen.findByText("message.server_accepted")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Inspect delivery" }));

    expect(await screen.findByText("Permanent failure")).toBeTruthy();
    expect(screen.getByText("Retryable failure")).toBeTruthy();
    expect(screen.getByText("HTTP 401")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Collapse delivery details" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Redeliver" }));
    await waitFor(() => expect(redeliverWebhookDelivery).toHaveBeenCalledWith(delivery.id));
    expect(getWebhookDelivery).toHaveBeenCalledTimes(2);
  });

  it("explains why terminal incoming message deliveries cannot be manually redelivered", async () => {
    const incoming = {
      ...delivery,
      id: "22222222-2222-4222-8222-222222222222",
      event: "message.received",
      messageId: "in_1234",
      status: "delivered" as const,
      lastStatusCode: 204,
      redeliveryAvailable: false,
    };
    vi.mocked(getWebhookDeliveries).mockResolvedValue({ success: true, deliveries: [incoming] });
    vi.mocked(getWebhookDelivery).mockResolvedValue({ success: true, delivery: { ...incoming, attempts: [] } });

    const user = userEvent.setup();
    render(<WebhookDeliveryDiagnostics />);

    expect(await screen.findByText("message.received")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Inspect delivery" }));

    expect(await screen.findByText(/Terminal incoming payload was removed/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Redeliver" })).toBeNull();
    expect(redeliverWebhookDelivery).not.toHaveBeenCalled();
  });
});
