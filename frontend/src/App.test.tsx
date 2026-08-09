import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";
import { RebindSessionDialog } from "./components/RebindSessionDialog.js";
import { bootstrapApp, getAppInfo, getCurrentQr, getHealth, setStoredApiKey } from "./api.js";

vi.mock("./api.js", () => ({
  getAppInfo: vi.fn(async () => ({
    success: true,
    appId: "wa-gateway-test",
    apiKeyRequired: true,
    apiKeyConfigured: true,
    apiKeySource: "generated",
    authenticated: true,
    setupRequired: false
  })),
  bootstrapApp: vi.fn(async () => ({
    success: true,
    appId: "wa-gateway-test",
    apiKey: "wa_test",
    message: "App initialized"
  })),
  getCurrentQr: vi.fn(async () => ({
    success: true,
    qr: null,
    status: "connecting"
  })),
  getHealth: vi.fn(async () => ({ status: "ok" })),
  getMessageStatus: vi.fn(),
  getQrImageSvg: vi.fn(async () => "<svg />"),
  getStoredApiKey: vi.fn(() => ""),
  getWhatsAppStatus: vi.fn(async () => ({
    success: true,
    status: "connecting"
  })),
  rebindWhatsApp: vi.fn(async () => ({
    success: true,
    message: "Rebind started",
    status: "qr"
  })),
  sendMessage: vi.fn(),
  setStoredApiKey: vi.fn()
}));

beforeEach(() => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible"
  });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.clearAllMocks();
});

describe("App rebind flow", () => {
  it("opens the rebind dialog from the session button even while connecting", async () => {
    const user = userEvent.setup();
    render(<App />);

    const openButton = await screen.findByRole("button", { name: /bind another account/i });

    expect((openButton as HTMLButtonElement).disabled).toBe(false);

    await user.click(openButton);

    expect(await screen.findByRole("dialog", { name: /bind another account/i })).toBeTruthy();
    expect((screen.getByRole("button", { name: /rebind session/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("requires typed confirmation before calling confirm", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(<RebindSessionDialog isOpen isRebinding={false} onCancel={vi.fn()} onConfirm={onConfirm} />);

    fireEvent.input(screen.getByLabelText(/type re bind/i), { target: { value: "RE BIND" } });

    const confirmButton = screen.getByRole("button", { name: /rebind session/i });

    await waitFor(() => {
      expect((confirmButton as HTMLButtonElement).disabled).toBe(false);
    });

    await user.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("does not poll the backend while the tab is hidden", async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden"
    });

    render(<App />);

    await vi.runOnlyPendingTimersAsync();

    expect(getHealth).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60000);

    expect(getHealth).toHaveBeenCalledTimes(1);
  });

  it("bootstraps the app from the UI when setup is required", async () => {
    vi.mocked(getAppInfo).mockResolvedValueOnce({
      success: true,
      appId: "wa-gateway-test",
      apiKeyRequired: true,
      apiKeyConfigured: false,
      apiKeySource: "unset",
      authenticated: false,
      setupRequired: true
    });
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole("button", { name: /initialize app/i }));

    await waitFor(() => {
      expect(bootstrapApp).toHaveBeenCalledTimes(1);
      expect(setStoredApiKey).toHaveBeenCalledWith("wa_test");
    });
  });

  it("does not call protected WhatsApp endpoints when the browser is not authenticated", async () => {
    vi.mocked(getAppInfo).mockResolvedValueOnce({
      success: true,
      appId: "wa-gateway-test",
      apiKeyRequired: true,
      apiKeyConfigured: true,
      apiKeySource: "generated",
      authenticated: false,
      setupRequired: false
    });

    render(<App />);

    expect(await screen.findByText(/authentication required/i)).toBeTruthy();
    expect(getCurrentQr).not.toHaveBeenCalled();
  });
});
