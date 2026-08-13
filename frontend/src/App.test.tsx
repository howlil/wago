import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";
import {
  allowRecipient,
  bootstrapApp,
  createApiKeyCandidate,
  createBrowserSession,
  getAppInfo,
  getCurrentQr,
  getHealth,
  listActivity,
  logoutBrowserSession,
  pairWhatsApp,
  sendMessage,
} from "./api.js";
import { RebindSessionDialog } from "./features/whatsapp/RebindSessionDialog.js";

const generatedApiKey = `wa_${"a".repeat(64)}`;

vi.mock("./api.js", () => ({
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
  getAppInfo: vi.fn(async () => ({
    success: true,
    appId: "wa-gateway-test",
    apiKeyRequired: true,
    apiKeyConfigured: true,
    apiKeySource: "generated",
    authenticated: true,
    credentialSetupRequired: false,
    setupRequired: false,
  })),
  bootstrapApp: vi.fn(async (candidate: string) => ({
    success: true,
    appId: "wa-gateway-test",
    apiKey: candidate,
    recovered: false,
    sessionExpiresAt: "2026-09-12T00:00:00.000Z",
    message: "App initialized",
  })),
  createApiKeyCandidate: vi.fn(() => generatedApiKey),
  createBrowserSession: vi.fn(async () => ({
    success: true,
    authenticated: true,
    expiresAt: "2026-09-12T00:00:00.000Z",
    message: "Browser session created",
  })),
  getCurrentQr: vi.fn(async () => ({ success: true, qr: null, status: "connected" })),
  getHealth: vi.fn(async () => ({ status: "ok" })),
  getMessageStatus: vi.fn(async () => ({
    success: true,
    id: "message-1",
    to: "6281234567890@s.whatsapp.net",
    status: "pending",
    updatedAt: "2026-08-10T00:00:00.000Z",
  })),
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
  listActivity: vi.fn(async () => ({ success: true, events: [] })),
  listRecipients: vi.fn(async () => ({ success: true, recipients: [] })),
  logoutBrowserSession: vi.fn(async () => ({
    success: true,
    authenticated: false,
    message: "Browser session ended",
  })),
  optOutRecipient: vi.fn(),
  pairWhatsApp: vi.fn(async () => ({ success: true, message: "Pairing started", status: "qr" })),
  rebindWhatsApp: vi.fn(async () => ({ success: true, message: "Pairing started", status: "qr" })),
  sendMessage: vi.fn(),
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

  it("generates credentials in memory first and then starts WhatsApp pairing", async () => {
    vi.mocked(getAppInfo).mockResolvedValueOnce({
      success: true,
      appId: "wa-gateway-test",
      apiKeyRequired: true,
      apiKeyConfigured: false,
      apiKeySource: "unset",
      authenticated: false,
      credentialSetupRequired: true,
      setupRequired: true,
    });
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: /pair whatsapp/i }));

    await waitFor(() => {
      expect(createApiKeyCandidate).toHaveBeenCalledTimes(1);
      expect(bootstrapApp).toHaveBeenCalledWith(generatedApiKey);
      expect(pairWhatsApp).toHaveBeenCalledTimes(1);
    });

    expect((screen.getByLabelText("API Key", { selector: "input" }) as HTMLInputElement).value).toBe(generatedApiKey);
    expect(screen.getAllByRole("button", { name: /^copy$/i }).length).toBeGreaterThanOrEqual(2);
  });

  it("signs a returning browser in by exchanging the API key for a browser session", async () => {
    vi.mocked(getAppInfo)
      .mockResolvedValueOnce({
        success: true,
        appId: "wa-gateway-test",
        apiKeyRequired: true,
        apiKeyConfigured: true,
        apiKeySource: "generated",
        authenticated: false,
        credentialSetupRequired: false,
        setupRequired: false,
      })
      .mockResolvedValue({
        success: true,
        appId: "wa-gateway-test",
        apiKeyRequired: true,
        apiKeyConfigured: true,
        apiKeySource: "generated",
        authenticated: true,
        credentialSetupRequired: false,
        setupRequired: false,
      });

    const user = userEvent.setup();
    render(<App />);

    const input = await screen.findByLabelText("API Key", { selector: "input" });
    await user.type(input, "wa_existing_secret");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(createBrowserSession).toHaveBeenCalledWith("wa_existing_secret");
    });
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("does not call protected WhatsApp endpoints when the browser is not authenticated", async () => {
    vi.mocked(getAppInfo).mockResolvedValueOnce({
      success: true,
      appId: "wa-gateway-test",
      apiKeyRequired: true,
      apiKeyConfigured: true,
      apiKeySource: "generated",
      authenticated: false,
      credentialSetupRequired: false,
      setupRequired: false,
    });
    render(<App />);
    expect(await screen.findByText(/sign in with the existing api key/i)).toBeTruthy();
    expect(getCurrentQr).not.toHaveBeenCalled();
  });

  it("keeps the pair action visible after signing out of the browser session", async () => {
    const user = userEvent.setup();
    vi.mocked(getAppInfo)
      .mockResolvedValueOnce({
        success: true,
        appId: "wa-gateway-test",
        apiKeyRequired: true,
        apiKeyConfigured: true,
        apiKeySource: "generated",
        authenticated: true,
        credentialSetupRequired: false,
        setupRequired: false,
      })
      .mockResolvedValue({
        success: true,
        appId: "wa-gateway-test",
        apiKeyRequired: true,
        apiKeyConfigured: true,
        apiKeySource: "generated",
        authenticated: false,
        credentialSetupRequired: false,
        setupRequired: false,
      });
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /^sign out$/i }));
    await waitFor(() => expect(logoutBrowserSession).toHaveBeenCalledTimes(1));

    expect(await screen.findByRole("button", { name: /pair whatsapp/i })).toBeTruthy();
  });

  it("shows why pairing is unavailable when the backend is down", async () => {
    vi.mocked(getHealth).mockRejectedValueOnce(new Error("offline"));
    render(<App />);
    expect(await screen.findByText(/backend is unavailable/i)).toBeTruthy();
  });

  it("lets the operator allow and resend a recipient blocked by policy", async () => {
    vi.mocked(sendMessage)
      .mockRejectedValueOnce({
        error: "RECIPIENT_NOT_ALLOWED",
        message: "Recipient is not allowed for outbound messages",
      })
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
