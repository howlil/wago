import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";
import { listActivity } from "./features/activity/api.js";
import {
  bootstrapApp,
  createApiKeyCandidate,
  createBrowserSession,
  getAppInfo,
  getHealth,
  logoutBrowserSession,
  rotateApiKey,
} from "./features/gateway/api.js";
import { sendMessage } from "./features/messages/api.js";
import { allowRecipient } from "./features/recipients/api.js";
import { ApiError } from "./shared/api/client.js";
import { getCurrentQr, getWhatsAppStatus, pairWhatsApp } from "./features/whatsapp/api.js";
import { RebindSessionDialog } from "./features/whatsapp/RebindSessionDialog.js";

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
  bootstrapApp: vi.fn(async (candidate: string) => ({
    success: true,
    appId: "wa-gateway-test",
    apiKey: candidate,
    recovered: false,
    message: "App initialized",
  })),
  createApiKeyCandidate: vi.fn(() => generatedApiKey),
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
  vi.clearAllMocks();
});

describe("dashboard", () => {
  it("renders Control as a dedicated workspace without an embedded Activity Log", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Control" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Control" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Audit Log" })).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Activity Log" })).toBeNull();
  });

  it("renders Audit Log as a dedicated workspace route", async () => {
    window.history.replaceState({}, "", "/audit");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Audit Log" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Audit Log" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Control" }).getAttribute("aria-current")).toBeNull();
  });

  it("collapses and restores the global sidebar", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
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
    await vi.runOnlyPendingTimersAsync();
    expect(getHealth).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60000);
    expect(getHealth).toHaveBeenCalledTimes(1);
  });

  it("signs in with the admin password before generating the machine API key and pairing", async () => {
    const firstRunAuthenticatedInfo = appInfo({
      apiKeyConfigured: false,
      apiKeySource: "unset",
      authenticated: true,
      credentialSetupRequired: true,
      setupRequired: true,
    });
    vi.mocked(getAppInfo)
      .mockResolvedValueOnce(
        appInfo({
          apiKeyConfigured: false,
          apiKeySource: "unset",
          authenticated: false,
          credentialSetupRequired: true,
          setupRequired: true,
        }),
      )
      .mockResolvedValue(firstRunAuthenticatedInfo);
    vi.mocked(getWhatsAppStatus).mockResolvedValueOnce({
      success: true,
      status: "disconnected",
      binding: { state: "unbound" },
      accountHealth: { availability: "unavailable" },
    });

    const user = userEvent.setup();
    render(<App />);

    const passwordInput = await screen.findByLabelText("Admin password", { selector: "input" });
    await user.type(passwordInput, adminPassword);
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(createBrowserSession).toHaveBeenCalledWith(adminPassword, "password");
    });

    await user.click(await screen.findByRole("button", { name: /pair whatsapp/i }));
    await waitFor(() => {
      expect(createApiKeyCandidate).toHaveBeenCalledTimes(1);
      expect(bootstrapApp).toHaveBeenCalledWith(generatedApiKey, undefined);
      expect(pairWhatsApp).toHaveBeenCalledTimes(1);
    });

    expect((screen.getByLabelText("Machine API key", { selector: "input" }) as HTMLInputElement).value).toBe(
      generatedApiKey,
    );
  });

  it("signs a returning browser in with the admin password", async () => {
    vi.mocked(getAppInfo)
      .mockResolvedValueOnce(appInfo({ authenticated: false }))
      .mockResolvedValue(appInfo({ authenticated: true }));

    const user = userEvent.setup();
    render(<App />);

    const input = await screen.findByLabelText("Admin password", { selector: "input" });
    await user.type(input, adminPassword);
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(createBrowserSession).toHaveBeenCalledWith(adminPassword, "password");
      expect((input as HTMLInputElement).value).toBe("");
    });
  });

  it("does not call protected WhatsApp endpoints when the browser is not authenticated", async () => {
    vi.mocked(getAppInfo).mockResolvedValueOnce(appInfo({ authenticated: false }));
    render(<App />);
    expect(await screen.findByText(/sign in with the admin password/i)).toBeTruthy();
    expect(getCurrentQr).not.toHaveBeenCalled();
  });

  it("keeps the pair action visible after signing out of the browser session", async () => {
    const user = userEvent.setup();
    vi.mocked(getAppInfo)
      .mockResolvedValueOnce(appInfo({ authenticated: true }))
      .mockResolvedValueOnce(appInfo({ authenticated: false }));
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /^sign out$/i }));
    await waitFor(() => expect(logoutBrowserSession).toHaveBeenCalledTimes(1));

    expect(await screen.findByRole("button", { name: /pair whatsapp/i })).toBeTruthy();
  });

  it("requires confirmation and shows the replacement API key after rotation", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /rotate api key/i }));
    expect(await screen.findByRole("dialog", { name: /rotate api key/i })).toBeTruthy();
    expect(rotateApiKey).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /rotate and revoke other sessions/i }));
    await waitFor(() => expect(rotateApiKey).toHaveBeenCalledTimes(1));

    expect((screen.getByLabelText("Machine API key", { selector: "input" }) as HTMLInputElement).value).toBe(
      rotatedApiKey,
    );
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
        new ApiError(
          403,
          "RECIPIENT_NOT_ALLOWED",
          "Recipient is not allowed for outbound messages",
          {
            success: false,
            error: "RECIPIENT_NOT_ALLOWED",
            message: "Recipient is not allowed for outbound messages",
          },
        ),
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

    expect(await screen.findByText(/last message status/i)).toBeTruthy();
  });
});
