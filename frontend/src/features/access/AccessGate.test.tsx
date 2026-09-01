import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../../shared/ui/tooltip.js";
import { getAppInfo } from "../gateway/api.js";
import { AccessGate } from "./AccessGate.js";

vi.mock("../gateway/api.js", () => ({
  getAppInfo: vi.fn(async () => ({
    success: true,
    appId: "wa-gateway-test",
    apiKeyRequired: true,
    apiKeyConfigured: true,
    apiKeySource: "generated",
    authenticated: false,
    adminPasswordConfigured: true,
    dashboardAuthMode: "password",
    credentialSetupRequired: false,
    setupRequired: false,
  })),
  createAdminAccount: vi.fn(),
  createBrowserSession: vi.fn(),
}));

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserverMock {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe("AccessGate", () => {
  it("labels the icon-only password visibility control with a focus tooltip", async () => {
    const user = userEvent.setup();
    vi.mocked(getAppInfo).mockResolvedValue({
      success: true,
      appId: "wa-gateway-test",
      apiKeyRequired: true,
      apiKeyConfigured: true,
      apiKeySource: "generated",
      authenticated: false,
      adminPasswordConfigured: true,
      dashboardAuthMode: "password",
      credentialSetupRequired: false,
      setupRequired: false,
    });

    render(
      <TooltipProvider delayDuration={0} skipDelayDuration={0}>
        <AccessGate>
          <div>Protected workspace</div>
        </AccessGate>
      </TooltipProvider>,
    );

    const password = await screen.findByLabelText("Admin password", { selector: "input" });
    await user.type(password, "correct-horse-battery-staple");

    const visibility = screen.getByRole("button", { name: "Show admin password" });
    expect(visibility.getAttribute("title")).toBeNull();

    visibility.focus();
    expect((await screen.findByRole("tooltip")).textContent).toContain("Show admin password");

    await user.click(visibility);
    expect((password as HTMLInputElement).type).toBe("text");
    expect(screen.getByRole("button", { name: "Hide admin password" })).toBeTruthy();
  });
});
