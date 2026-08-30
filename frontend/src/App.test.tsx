import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";
import { getActivity } from "./features/activity/api.js";
import { createAdminPassword, getAccessState, signIn, signOut } from "./features/access/api.js";
import { getGatewayInfo, getHealth, getReadiness, rotateApiKey, setupGateway } from "./features/gateway/api.js";
import { sendMessage } from "./features/messages/api.js";
import { allowRecipient, listRecipients } from "./features/recipients/api.js";
import { getWebhookSettings } from "./features/settings/api.js";
import { pairWhatsApp, rebindWhatsApp, getWhatsAppQr, getWhatsAppStatus } from "./features/whatsapp/api.js";
import { ApiError } from "./shared/api/client.js";

vi.mock("./features/access/api.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./features/access/api.js")>();
  return {
    ...original,
    createAdminPassword: vi.fn(),
    getAccessState: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  };
});

vi.mock("./features/activity/api.js", () => ({ getActivity: vi.fn() }));
vi.mock("./features/gateway/api.js", () => ({
  getGatewayInfo: vi.fn(),
  getHealth: vi.fn(),
  getReadiness: vi.fn(),
  rotateApiKey: vi.fn(),
  setupGateway: vi.fn(),
}));
vi.mock("./features/messages/api.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./features/messages/api.js")>();
  return { ...original, sendMessage: vi.fn() };
});
vi.mock("./features/recipients/api.js", () => ({
  allowRecipient: vi.fn(),
  listRecipients: vi.fn(),
  optOutRecipient: vi.fn(),
}));
vi.mock("./features/settings/api.js", () => ({
  getWebhookSettings: vi.fn(),
  updateWebhookSettings: vi.fn(),
}));
vi.mock("./features/whatsapp/api.js", () => ({
  getWhatsAppQr: vi.fn(),
  getWhatsAppStatus: vi.fn(),
  pairWhatsApp: vi.fn(),
  rebindWhatsApp: vi.fn(),
}));

const rawApiKey = "wa_test_generated_key_12345678901234567890123456789012";
const rotatedApiKey = "wa_test_rotated_key_12345678901234567890123456789012";

function authenticatedAccessState() {
  return {
    setup: true,
    authenticated: true,
    adminPasswordConfigured: true,
    browserSessionConfigured: true,
    apiKeyConfigured: true,
    apiKeySource: "database" as const,
  };
}

function unauthenticatedAccessState() {
  return {
    setup: true,
    authenticated: false,
    adminPasswordConfigured: true,
    browserSessionConfigured: true,
    apiKeyConfigured: true,
    apiKeySource: "database" as const,
  };
}

function freshAccessState() {
  return {
    setup: false,
    authenticated: false,
    adminPasswordConfigured: false,
    browserSessionConfigured: false,
    apiKeyConfigured: false,
    apiKeySource: "none" as const,
  };
}

function connectedWhatsAppStatus() {
  return {
    success: true as const,
    status: "connected" as const,
    binding: {
      state: "bound" as const,
      phone: "6281234567890",
      jid: "6281234567890@s.whatsapp.net",
      boundAt: "2026-08-30T01:00:00.000Z",
    },
    accountHealth: {
      availability: "available" as const,
      checkedAt: "2026-08-30T01:00:00.000Z",
      reachoutTimeLock: { isActive: false },
      newChatCap: { status: "NONE" },
    },
  };
}

function disconnectedWhatsAppStatus() {
  return {
    success: true as const,
    status: "disconnected" as const,
    binding: { state: "unbound" as const },
    accountHealth: {
      availability: "unavailable" as const,
      unavailableReason: "not_connected" as const,
    },
  };
}

function defaultReadiness() {
  return {
    status: "ready" as const,
    ready: true,
    appId: "app-1",
    apiKeyConfigured: true,
    webhookConfigured: false,
  };
}

function defaultGatewayInfo() {
  return {
    appId: "app-1",
    setup: true,
    authenticated: true,
    apiKeyConfigured: true,
    apiKeySource: "database" as const,
    adminPasswordConfigured: true,
  };
}

function mockControlBaseline() {
  vi.mocked(getAccessState).mockResolvedValue(authenticatedAccessState());
  vi.mocked(getGatewayInfo).mockResolvedValue(defaultGatewayInfo());
  vi.mocked(getHealth).mockResolvedValue({ status: "ok" });
  vi.mocked(getReadiness).mockResolvedValue(defaultReadiness());
  vi.mocked(getWhatsAppStatus).mockResolvedValue(connectedWhatsAppStatus());
  vi.mocked(getWhatsAppQr).mockResolvedValue({ qr: null, status: "connected" });
  vi.mocked(getActivity).mockResolvedValue({ success: true, events: [] });
  vi.mocked(listRecipients).mockResolvedValue({ success: true, recipients: [] });
  vi.mocked(getWebhookSettings).mockResolvedValue({
    success: true,
    enabled: false,
    url: null,
    hasSecret: false,
    updatedAt: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/");
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  mockControlBaseline();
  vi.mocked(pairWhatsApp).mockResolvedValue({ success: true, status: "connecting" });
  vi.mocked(rebindWhatsApp).mockResolvedValue({ success: true, status: "connecting" });
  vi.mocked(allowRecipient).mockResolvedValue({ success: true, recipient: { phone: "6281275584870" } });
  vi.mocked(setupGateway).mockResolvedValue({ success: true, apiKey: rawApiKey });
  vi.mocked(rotateApiKey).mockResolvedValue({ success: true, apiKey: rotatedApiKey });
  vi.mocked(createAdminPassword).mockResolvedValue({ success: true });
  vi.mocked(signIn).mockResolvedValue({ success: true });
  vi.mocked(signOut).mockResolvedValue({ success: true });
});

describe("dashboard", () => {
  it("renders Control as the operational workspace without configuration or embedded audit", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Control" })).toBeTruthy();
    expect(await screen.findByText(/operational readiness/i)).toBeTruthy();
    expect(screen.getByText(/connected to whatsapp/i)).toBeTruthy();
    expect(screen.queryByText(/gateway access/i)).toBeNull();
    expect(screen.queryByRole("heading", { name: /audit log/i })).toBeNull();
  });

  it("renders Settings as the configuration workspace", async () => {
    window.history.replaceState({}, "", "/settings");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeTruthy();
    expect(await screen.findByText(/gateway access/i)).toBeTruthy();
    expect(screen.getByText(/recipient policy/i)).toBeTruthy();
    expect(screen.getByText(/webhook delivery/i)).toBeTruthy();
  });

  it("renders Audit Log as a dedicated investigation workspace route", async () => {
    window.history.replaceState({}, "", "/audit");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Audit Log" })).toBeTruthy();
    expect(await screen.findByText(/investigate sanitized operational evidence/i)).toBeTruthy();
  });

  it("collapses and restores the global sidebar", async () => {
    const user = userEvent.setup();
    render(<App />);

    const collapse = await screen.findByRole("button", { name: /collapse sidebar/i });
    await user.click(collapse);
    expect(screen.getByRole("button", { name: /expand sidebar/i })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /expand sidebar/i }));
    expect(screen.getByRole("button", { name: /collapse sidebar/i })).toBeTruthy();
  });

  it("handles malformed activity responses without crashing the dashboard", async () => {
    vi.mocked(getActivity).mockResolvedValueOnce({ success: true, events: null as never });
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Control" })).toBeTruthy();
  });

  it("opens the change-account dialog for an existing binding", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /change account/i }));
    expect(await screen.findByRole("dialog", { name: /change whatsapp account/i })).toBeTruthy();
  });

  it("confirms a new pairing session with one explicit click", async () => {
    vi.mocked(getWhatsAppStatus).mockResolvedValue(disconnectedWhatsAppStatus());
    vi.mocked(getWhatsAppQr).mockResolvedValue({ qr: null, status: "disconnected" });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /pair whatsapp/i }));
    await waitFor(() => expect(pairWhatsApp).toHaveBeenCalledTimes(1));
  });

  it("does not poll the backend while the tab is hidden", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    render(<App />);
    await screen.findByRole("heading", { name: "Control" });

    const healthCalls = vi.mocked(getHealth).mock.calls.length;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(vi.mocked(getHealth).mock.calls.length).toBe(healthCalls);
  });

  it("sets up the admin credential and pairs WhatsApp without generating a machine API key", async () => {
    vi.mocked(getAccessState)
      .mockResolvedValueOnce(freshAccessState())
      .mockResolvedValue(authenticatedAccessState());
    vi.mocked(getGatewayInfo)
      .mockResolvedValueOnce({
        ...defaultGatewayInfo(),
        setup: false,
        authenticated: false,
        apiKeyConfigured: false,
        apiKeySource: "none",
        adminPasswordConfigured: false,
      })
      .mockResolvedValue(defaultGatewayInfo());
    vi.mocked(getWhatsAppStatus).mockResolvedValue(disconnectedWhatsAppStatus());
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText("Admin password"), "correct-horse-battery-staple");
    await user.type(screen.getByLabelText("Confirm admin password"), "correct-horse-battery-staple");
    await user.click(screen.getByRole("button", { name: /create admin password/i }));

    await waitFor(() => expect(createAdminPassword).toHaveBeenCalledTimes(1));
    expect(setupGateway).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: /pair whatsapp/i }));
    await waitFor(() => expect(pairWhatsApp).toHaveBeenCalledTimes(1));
  });

  it("generates a machine API key only from Settings", async () => {
    vi.mocked(getAccessState).mockResolvedValue({ ...authenticatedAccessState(), apiKeyConfigured: false });
    vi.mocked(getGatewayInfo).mockResolvedValue({
      ...defaultGatewayInfo(),
      apiKeyConfigured: false,
      apiKeySource: "none",
    });
    window.history.replaceState({}, "", "/settings");
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /generate api key/i }));
    await waitFor(() => expect(setupGateway).toHaveBeenCalledTimes(1));
    expect((screen.getByLabelText("Machine API key", { selector: "input" }) as HTMLInputElement).value).toBe(rawApiKey);
  });

  it("does not submit first-run setup when password confirmation differs", async () => {
    vi.mocked(getAccessState).mockResolvedValue(freshAccessState());
    vi.mocked(getGatewayInfo).mockResolvedValue({
      ...defaultGatewayInfo(),
      setup: false,
      authenticated: false,
      apiKeyConfigured: false,
      apiKeySource: "none",
      adminPasswordConfigured: false,
    });
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText("Admin password"), "correct-horse-battery-staple");
    await user.type(screen.getByLabelText("Confirm admin password"), "different-password");
    await user.click(screen.getByRole("button", { name: /create admin password/i }));

    expect(createAdminPassword).not.toHaveBeenCalled();
    expect(await screen.findByText(/password confirmation does not match/i)).toBeTruthy();
  });

  it("signs a returning browser in and keeps the requested workspace", async () => {
    vi.mocked(getAccessState)
      .mockResolvedValueOnce(unauthenticatedAccessState())
      .mockResolvedValue(authenticatedAccessState());
    vi.mocked(getGatewayInfo)
      .mockResolvedValueOnce({ ...defaultGatewayInfo(), authenticated: false })
      .mockResolvedValue(defaultGatewayInfo());
    window.history.replaceState({}, "", "/audit");
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText("Admin password"), "correct-horse-battery-staple");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("heading", { name: "Audit Log" })).toBeTruthy();
  });

  it("does not render protected workspaces or call WhatsApp endpoints before authentication", async () => {
    vi.mocked(getAccessState).mockResolvedValue(unauthenticatedAccessState());
    vi.mocked(getGatewayInfo).mockResolvedValue({ ...defaultGatewayInfo(), authenticated: false });
    render(<App />);

    expect(await screen.findByRole("button", { name: /sign in/i })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Control" })).toBeNull();
    expect(getWhatsAppStatus).not.toHaveBeenCalled();
    expect(getWhatsAppQr).not.toHaveBeenCalled();
  });

  it("returns to the sign-in surface after signing out from Settings", async () => {
    vi.mocked(getAccessState)
      .mockResolvedValueOnce(authenticatedAccessState())
      .mockResolvedValue(unauthenticatedAccessState());
    vi.mocked(getGatewayInfo)
      .mockResolvedValueOnce(defaultGatewayInfo())
      .mockResolvedValue({ ...defaultGatewayInfo(), authenticated: false });
    window.history.replaceState({}, "", "/settings");
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /sign out/i }));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("button", { name: /sign in/i })).toBeTruthy();
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
