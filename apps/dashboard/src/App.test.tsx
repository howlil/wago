import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";
import { listActivity } from "./features/activity/api.js";
import {
  createAdminAccount,
  createBrowserSession,
  generateApiKey,
  getAppInfo,
  getHealth,
  logoutBrowserSession,
  rotateApiKey,
} from "./features/gateway/api.js";
import { sendMessage } from "./features/messages/api.js";
import { allowRecipient } from "./features/recipients/api.js";
import { getCurrentQr, getWhatsAppStatus, pairWhatsApp } from "./features/whatsapp/api.js";
import { RebindSessionDialog } from "./features/whatsapp/RebindSessionDialog.js";
import { ApiError } from "./shared/api/client.js";

const generatedApiKey = `wa_${"a".repeat(64)}`;
const rotatedApiKey = `wa_${"d".repeat(43)}`;
const adminPassword = "correct-horse-battery-staple";

function appInfo(overrides: Partial<Awaited<ReturnType<typeof getAppInfo>>> = {}) {
  return {
    success: true as const,
    appId: "wa-gateway-test",
    apiKeyRequired: true,
    apiKeyConfigured: true,
    apiKeySource: "generated" as const,
    authenticated: true,
    adminPasswordConfigured: true,
    dashboardAuthMode: "password" as const,
    credentialSetupRequired: false,
    setupRequired: false,
    ...overrides,
  };
}

vi.mock("./features/activity/api.js", () => ({
  listActivity: vi.fn(async () => ({ success: true, events: [] })),
}));

vi.mock("./features/gateway/api.js", () => ({
  getAppInfo: vi.fn(async () => appInfo()),
  generateApiKey: vi.fn(async () => ({
    success: true,
    appId: "wa-gateway-test",
    apiKey: generatedApiKey,
    recovered: false,
    message: "App initialized",
  })),
  createAdminAccount: vi.fn(async () => ({
    success: true,
    authenticated: true,
    expiresAt: "2026-09-12T00:00:00.000Z",
    message: "Admin account created",
  })),
  createBrowserSession: vi.fn(async () => ({
    success: true,
    authenticated: true,
    expiresAt: "2026-09-12T00:00:00.000Z",
    message: "Browser session created",
  })),
  getHealth: vi.fn(async () => ({ status: "ok" })),
  logoutBrowserSession: vi.fn(async () => ({
    success: true,
    authenticated: false,
    message: "Browser session ended",
  })),
  logoutAllBrowserSessions: vi.fn(async () => ({
    success: true,
    authenticated: false,
    message: "All browser sessions ended",
  })),
  rotateApiKey: vi.fn(async () => ({
    success: true,
    apiKey: rotatedApiKey,
    generatedAt: "2026-08-14T00:00:00.000Z",
    message: "API key rotated",
  })),
}));

vi.mock("./features/recipients/api.js", () => ({
  allowRecipient: vi.fn(async (phone: string) => ({
    success: true,
    recipient: {
      jid: `${phone}@s.whatsapp.net`,
      allowed: true,
      optedOut: false,
      createdAt: "2026-08-10T00:00:00.000Z",
      updatedAt: "2026-08-10T00:00:00.000Z",
    },
  })),
  listRecipients: vi.fn(async () => ({ success: true, recipients: [] })),
  optOutRecipient: vi.fn(),
}));

vi.mock("./features/messages/api.js", () => ({
  getMessageStatus: vi.fn(async () => ({
    success: true,
    id: "message-1",
    to: "6281234567890@s.whatsapp.net",
    status: "pending",
    updatedAt: "2026-08-10T00:00:00.000Z",
  })),
  sendMessage: vi.fn(),
}));

vi.mock("./features/whatsapp/api.js", () => ({
  getCurrentQr: vi.fn(async () => ({ success: true, qr: null, status: "connected" })),
  getQrImageSvg: vi.fn(async () => "<svg />"),
  getWhatsAppStatus: vi.fn(async () => ({
    success: true,
    status: "connected",
    binding: {
      state: "bound",
      jid: "6281234567890@s.whatsapp.net",
      phone: "6281234567890",
      boundAt: "2026-08-10T00:00:00.000Z",
    },
    accountHealth: { availability: "available" },
  })),
  pairWhatsApp: vi.fn(async () => ({ success: true, message: "Pairing started", status: "qr" })),
  rebindWhatsApp: vi.fn(async () => ({ success: true, message: "Pairing started", status: "qr" })),
}));

beforeEach(() => {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.resetAllMocks();
});

describe("dashboard", () => {
  it("renders Control as the operational workspace without configuration or embedded audit", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Control" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Control" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Settings" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Audit Log" })).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Activity Log" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Machine access" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Recipient access" })).toBeNull();
  });

  it("renders Settings as a single-module configuration workspace", async () => {
    window.history.replaceState({}, "", "/settings");
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Settings" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("heading", { name: "Machine access" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Recipient access" })).toBeNull();

    await user.click(screen.getByRole("link", { name: "Messaging" }));
    expect(await screen.findByRole("heading", { name: "Recipient access" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Machine access" })).toBeNull();

    await user.click(screen.getByRole("link", { name: "Webhooks" }));
    expect(await screen.findByRole("heading", { name: "Webhook integration" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Recipient access" })).toBeNull();

    await user.click(screen.getByRole("link", { name: "Sessions" }));
    expect(await screen.findByRole("heading", { name: "Dashboard session" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Webhook integration" })).toBeNull();
  });

  it("renders Audit Log as a dedicated investigation workspace route", async () => {
    window.history.replaceState({}, "", "/audit");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Audit Log" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Audit Log" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Control" }).getAttribute("aria-current")).toBeNull();
  });

  it("collapses and restores the global sidebar", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Collapse sidebar" }));
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeTruthy();
  });

  it("handles malformed activity responses without crashing the dashboard", async () => {
    vi.mocked(listActivity).mockResolvedValueOnce({ success: true, events: undefined } as never);

    window.history.replaceState({}, "", "/audit");
    render(<App />);

    expect(await screen.findByText(/activity endpoint returned an invalid response/i)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Audit Log" })).toBeTruthy();
  });

  it("opens the change-account dialog for an existing binding", async () => {
    const user = userEvent.setup();
    render(<App />);

    const openButton = await screen.findByRole("button", { name: /change account/i });
    expect((openButton as HTMLButtonElement).disabled).toBe(false);
    await user.click(openButton);
    expect(await screen.findByRole("dialog", { name: /start a new pairing session/i })).toBeTruthy();
  });

  it("confirms a new pairing session with one explicit click", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<RebindSessionDialog isOpen isRebinding={false} onCancel={vi.fn()} onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: /start new pairing/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("does not poll the backend while the tab is hidden", async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    render(<App />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(getHealth).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(getHealth).toHaveBeenCalledTimes(1);
  });

  it("sets up the admin credential and pairs WhatsApp without generating a machine API key", async () => {
    const firstRunUnauthenticatedInfo = appInfo({
      apiKeyConfigured: false,
      apiKeySource: "unset",
      authenticated: false,
      adminPasswordConfigured: false,
      dashboardAuthMode: "setup",
      credentialSetupRequired: true,
      setupRequired: true,
    });
    const firstRunAuthenticatedInfo = appInfo({
      apiKeyConfigured: false,
      apiKeySource: "unset",
      authenticated: true,
      adminPasswordConfigured: true,
      dashboardAuthMode: "password",
      credentialSetupRequired: true,
      setupRequired: true,
    });
    vi.mocked(getAppInfo).mockResolvedValue(firstRunUnauthenticatedInfo);
    vi.mocked(createAdminAccount).mockImplementationOnce(async () => {
      vi.mocked(getAppInfo).mockResolvedValue(firstRunAuthenticatedInfo);
      return {
        success: true,
        authenticated: true,
        expiresAt: "2026-09-12T00:00:00.000Z",
        message: "Admin account created",
      };
    });
    vi.mocked(getWhatsAppStatus).mockResolvedValueOnce({
      success: true,
      status: "disconnected",
      binding: { state: "unbound", jid: null, phone: null, boundAt: null },
      accountHealth: { availability: "unavailable" },
    });

    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole("heading", { name: /set up your gateway/i })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Control" })).toBeNull();
    const passwordInput = screen.getByLabelText("Admin password", { selector: "input" });
    const confirmationInput = screen.getByLabelText("Confirm password", { selector: "input" });
    await user.type(passwordInput, adminPassword);
    await user.type(confirmationInput, adminPassword);
    await user.click(screen.getByRole("button", { name: /set up wago/i }));

    await waitFor(() => {
      expect(createAdminAccount).toHaveBeenCalledWith(adminPassword);
      expect(createBrowserSession).not.toHaveBeenCalled();
    });

    await user.click(await screen.findByRole("button", { name: /pair whatsapp/i }));
    await waitFor(() => expect(pairWhatsApp).toHaveBeenCalledTimes(1));

    expect(generateApiKey).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Machine API key", { selector: "input" })).toBeNull();
    expect(screen.getByRole("link", { name: "Settings" })).toBeTruthy();
  });

  it("generates a machine API key only from Settings", async () => {
    window.history.replaceState({}, "", "/settings");
    vi.mocked(getAppInfo).mockResolvedValue(
      appInfo({
        apiKeyConfigured: false,
        apiKeySource: "unset",
        credentialSetupRequired: true,
        setupRequired: true,
      }),
    );

    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /generate api key/i }));
    await waitFor(() => expect(generateApiKey).toHaveBeenCalledTimes(1));

    expect(await screen.findByText("New API key")).toBeTruthy();
    expect(screen.getByText(generatedApiKey)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hide API key" })).toBeTruthy();
    expect(pairWhatsApp).not.toHaveBeenCalled();
  });

  it("does not submit first-run setup when password confirmation differs", async () => {
    vi.mocked(getAppInfo).mockResolvedValue(
      appInfo({
        apiKeyConfigured: false,
        apiKeySource: "unset",
        authenticated: false,
        adminPasswordConfigured: false,
        dashboardAuthMode: "setup",
        credentialSetupRequired: true,
        setupRequired: true,
      }),
    );

    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText("Admin password", { selector: "input" }), adminPassword);
    await user.type(screen.getByLabelText("Confirm password", { selector: "input" }), `${adminPassword}-different`);
    await user.click(screen.getByRole("button", { name: /set up wago/i }));

    expect((await screen.findByRole("alert")).textContent).toContain("Passwords do not match.");
    expect(createAdminAccount).not.toHaveBeenCalled();
  });

  it("signs a returning browser in and keeps the requested workspace", async () => {
    window.history.replaceState({}, "", "/settings");
    vi.mocked(getAppInfo)
      .mockResolvedValueOnce(appInfo({ authenticated: false }))
      .mockResolvedValue(appInfo({ authenticated: true }));

    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Settings" })).toBeNull();
    const input = screen.getByLabelText("Admin password", { selector: "input" });
    await user.type(input, adminPassword);
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(createBrowserSession).toHaveBeenCalledWith(adminPassword));
    expect(await screen.findByRole("heading", { name: "Settings" })).toBeTruthy();
    expect(screen.queryByLabelText("Admin password", { selector: "input" })).toBeNull();
  });

  it("does not render protected workspaces or call WhatsApp endpoints before authentication", async () => {
    vi.mocked(getAppInfo).mockResolvedValue(appInfo({ authenticated: false }));
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Control" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();
    expect(getCurrentQr).not.toHaveBeenCalled();
    expect(getWhatsAppStatus).not.toHaveBeenCalled();
  });

  it("returns to the sign-in surface after signing out from Settings", async () => {
    window.history.replaceState({}, "", "/settings#sessions");
    const user = userEvent.setup();
    vi.mocked(getAppInfo).mockResolvedValue(appInfo({ authenticated: true }));
    vi.mocked(logoutBrowserSession).mockImplementationOnce(async () => {
      vi.mocked(getAppInfo).mockResolvedValue(appInfo({ authenticated: false }));
      return {
        success: true,
        authenticated: false,
        message: "Browser session ended",
      };
    });
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /^sign out$/i }));
    await waitFor(() => expect(logoutBrowserSession).toHaveBeenCalledTimes(1));

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Settings" })).toBeNull();
  });

  it("requires confirmation and shows the replacement API key after rotation in Settings", async () => {
    window.history.replaceState({}, "", "/settings");
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /rotate api key/i }));
    expect(await screen.findByRole("dialog", { name: /rotate api key/i })).toBeTruthy();
    expect(rotateApiKey).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /rotate and revoke other sessions/i }));
    await waitFor(() => expect(rotateApiKey).toHaveBeenCalledTimes(1));

    expect(await screen.findByText("New API key")).toBeTruthy();
    expect(screen.getByText(rotatedApiKey)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hide API key" })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: /rotate api key/i })).toBeNull();
  });

  it("shows why pairing is unavailable when the backend is down", async () => {
    vi.mocked(getHealth).mockRejectedValueOnce(new Error("offline"));
    render(<App />);
    expect(await screen.findByText(/backend is unavailable/i)).toBeTruthy();
  });

  it("lets the operator allow and resend a recipient blocked by policy", async () => {
    vi.mocked(sendMessage)
      .mockRejectedValueOnce(
        new ApiError(403, "RECIPIENT_NOT_ALLOWED", "Recipient is not allowed for outbound messages", {
          success: false,
          error: "RECIPIENT_NOT_ALLOWED",
          message: "Recipient is not allowed for outbound messages",
        }),
      )
      .mockResolvedValueOnce({ success: true, messageId: "message-1", status: "pending" });
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText("Message recipient phone"), "6281275584870");
    await user.type(screen.getByLabelText("Message text"), "test");
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    const allowAndSend = await screen.findByRole("button", { name: /allow & send/i });
    await user.click(allowAndSend);

    await waitFor(() => {
      expect(allowRecipient).toHaveBeenCalledWith("6281275584870");
      expect(sendMessage).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText(/message diagnostics/i)).toBeTruthy();
  });
});
