import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";
import { bootstrapApp, getAppInfo, getCurrentQr, getHealth, setStoredApiKey } from "./api.js";
import { RebindSessionDialog } from "./components/RebindSessionDialog.js";

vi.mock("./api.js", () => ({
  getAppInfo: vi.fn(async () => ({
    success: true,
    appId: "wa-gateway-test",
    apiKeyRequired: true,
    apiKeyConfigured: true,
    apiKeySource: "generated",
    authenticated: true,
    setupRequired: false,
  })),
  bootstrapApp: vi.fn(async () => ({
    success: true,
    appId: "wa-gateway-test",
    apiKey: "wa_test",
    message: "App initialized",
  })),
  getCurrentQr: vi.fn(async () => ({
    success: true,
    qr: null,
    status: "connecting",
  })),
  getHealth: vi.fn(async () => ({ status: "ok" })),
  getMessageStatus: vi.fn(),
  getQrImageSvg: vi.fn(async () => "<svg />"),
  getStoredApiKey: vi.fn(() => ""),
  getWhatsAppStatus: vi.fn(async () => ({
    success: true,
    status: "connecting",
  })),
  rebindWhatsApp: vi.fn(async () => ({
    success: true,
    message: "Pairing started",
    status: "qr",
  })),
  sendMessage: vi.fn(),
  setStoredApiKey: vi.fn(),
}));

beforeEach(() => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.clearAllMocks();
});

describe("App pairing flow", () => {
  it("opens the new pairing dialog while authenticated", async () => {
    const user = userEvent.setup();
    render(<App />);

    const openButton = await screen.findByRole("button", { name: /start new pairing/i });
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
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });

    render(<App />);

    await vi.runOnlyPendingTimersAsync();
    expect(getHealth).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60000);
    expect(getHealth).toHaveBeenCalledTimes(1);
  });

  it("generates credentials automatically when the user starts first pairing", async () => {
    vi.mocked(getAppInfo).mockResolvedValue({
      success: true,
      appId: "wa-gateway-test",
      apiKeyRequired: true,
      apiKeyConfigured: false,
      apiKeySource: "unset",
      authenticated: false,
      setupRequired: true,
    });
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole("button", { name: /pair whatsapp/i }));

    await waitFor(() => {
      expect(bootstrapApp).toHaveBeenCalledTimes(1);
      expect(setStoredApiKey).toHaveBeenCalledWith("wa_test");
    });

    expect((screen.getByLabelText(/api key/i) as HTMLInputElement).value).toBe("wa_test");
    expect(screen.getAllByRole("button", { name: /^copy$/i }).length).toBeGreaterThanOrEqual(2);
  });

  it("does not call protected WhatsApp endpoints when the browser is not authenticated", async () => {
    vi.mocked(getAppInfo).mockResolvedValue({
      success: true,
      appId: "wa-gateway-test",
      apiKeyRequired: true,
      apiKeyConfigured: true,
      apiKeySource: "generated",
      authenticated: false,
      setupRequired: false,
    });

    render(<App />);

    expect(await screen.findByText(/enter the existing api key above/i)).toBeTruthy();
    expect(getCurrentQr).not.toHaveBeenCalled();
  });

  it("shows why pairing is unavailable when the backend is down", async () => {
    vi.mocked(getHealth).mockRejectedValueOnce(new Error("offline"));

    render(<App />);

    expect(await screen.findByText(/backend is unavailable/i)).toBeTruthy();
  });
});
