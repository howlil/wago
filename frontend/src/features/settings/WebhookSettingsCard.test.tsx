import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeWebhookSecretRotation,
  getWebhookSettings,
  rotateWebhookSecret,
  sendWebhookTest,
  updateWebhookSettings,
} from "./api.js";
import { WebhookSettingsCard } from "./WebhookSettingsCard.js";

vi.mock("./api.js", () => ({
  getWebhookSettings: vi.fn(),
  updateWebhookSettings: vi.fn(),
  rotateWebhookSecret: vi.fn(),
  completeWebhookSecretRotation: vi.fn(),
  sendWebhookTest: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(getWebhookSettings).mockResolvedValue({
    success: true,
    enabled: false,
    url: null,
    secretConfigured: false,
    rotationPending: false,
    updatedAt: null,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WebhookSettingsCard", () => {
  it("enables webhook delivery and shows a newly generated signing secret once", async () => {
    vi.mocked(updateWebhookSettings).mockResolvedValue({
      success: true,
      enabled: true,
      url: "https://receiver.example.test/webhooks/wago",
      secretConfigured: true,
      rotationPending: false,
      updatedAt: "2026-08-13T01:00:00.000Z",
      generatedSecret: "generated-secret-value",
    });

    const user = userEvent.setup();
    render(<WebhookSettingsCard />);

    const enabled = await screen.findByRole("checkbox", { name: "Enable webhook delivery" });
    await user.click(enabled);
    await user.type(
      screen.getByPlaceholderText("https://your-backend.example.com/webhooks/wago"),
      "https://receiver.example.test/webhooks/wago",
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(updateWebhookSettings).toHaveBeenCalledWith({
        enabled: true,
        url: "https://receiver.example.test/webhooks/wago",
      });
    });
    expect(await screen.findByDisplayValue("generated-secret-value")).toBeTruthy();
    expect(screen.getByText("Copy the new signing secret now")).toBeTruthy();
  });

  it("sends a production-path test webhook and reports the immediate attempt result", async () => {
    vi.mocked(getWebhookSettings).mockResolvedValue({
      success: true,
      enabled: true,
      url: "https://receiver.example.test/webhooks/wago",
      secretConfigured: true,
      rotationPending: false,
      updatedAt: "2026-08-26T03:00:00.000Z",
    });
    vi.mocked(sendWebhookTest).mockResolvedValue({
      success: true,
      delivery: {
        id: "11111111-1111-4111-8111-111111111111",
        event: "wago.test",
        status: "delivered",
        lastStatusCode: 204,
        lastErrorCode: null,
      },
    });

    const user = userEvent.setup();
    render(<WebhookSettingsCard />);

    await user.click(await screen.findByRole("button", { name: "Send test webhook" }));

    await waitFor(() => expect(sendWebhookTest).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Test webhook delivered (HTTP 204).")).toBeTruthy();
  });

  it("rotates and completes signing-secret overlap", async () => {
    vi.mocked(getWebhookSettings).mockResolvedValue({
      success: true,
      enabled: true,
      url: "https://receiver.example.test/webhooks/wago",
      secretConfigured: true,
      rotationPending: false,
      updatedAt: "2026-08-13T01:00:00.000Z",
    });
    vi.mocked(rotateWebhookSecret).mockResolvedValue({
      success: true,
      enabled: true,
      url: "https://receiver.example.test/webhooks/wago",
      secretConfigured: true,
      rotationPending: true,
      updatedAt: "2026-08-13T01:01:00.000Z",
      generatedSecret: "rotated-secret-value",
    });
    vi.mocked(completeWebhookSecretRotation).mockResolvedValue({
      success: true,
      enabled: true,
      url: "https://receiver.example.test/webhooks/wago",
      secretConfigured: true,
      rotationPending: false,
      updatedAt: "2026-08-13T01:02:00.000Z",
    });

    const user = userEvent.setup();
    render(<WebhookSettingsCard />);

    await user.click(await screen.findByRole("button", { name: "Rotate secret" }));
    expect(await screen.findByDisplayValue("rotated-secret-value")).toBeTruthy();
    expect(screen.getByText(/Rotation overlap is active/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Complete rotation" }));
    await waitFor(() => expect(completeWebhookSecretRotation).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Rotation overlap is active/)).toBeNull();
  });
});
