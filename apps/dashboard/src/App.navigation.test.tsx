import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";

const accessGateRenders = vi.hoisted(() => ({ count: 0 }));

vi.mock("./features/access/AccessGate.js", () => ({
  AccessGate: ({ children }: { children: import("react").ReactNode }) => {
    accessGateRenders.count += 1;
    return children;
  },
}));

vi.mock("./shared/ui/tooltip.js", () => ({
  TooltipProvider: ({ children }: { children: import("react").ReactNode }) => children,
}));

vi.mock("./pages/dashboard/DashboardPage.js", () => ({
  DashboardPage: () => (
    <main>
      <h1>Control page</h1>
      <a href="/settings">Settings</a>
      <a href="/audit?category=connection">Investigate</a>
    </main>
  ),
}));

vi.mock("./pages/settings/SettingsPage.js", () => ({
  SettingsPage: () => (
    <main>
      <h1>Settings page</h1>
      <a href="/audit">Audit Log</a>
    </main>
  ),
}));

vi.mock("./pages/audit/AuditPage.js", () => ({
  AuditPage: () => (
    <main>
      <h1>Audit page</h1>
      <span>{window.location.search}</span>
      <a href="/">Control</a>
    </main>
  ),
}));

beforeEach(() => {
  accessGateRenders.count = 0;
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  cleanup();
});

describe("workspace navigation", () => {
  it("switches workspace routes without remounting the access gate", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole("heading", { name: "Control page" })).toBeTruthy();
    expect(accessGateRenders.count).toBe(1);

    await user.click(screen.getByRole("link", { name: "Settings" }));

    expect(window.location.pathname).toBe("/settings");
    expect(await screen.findByRole("heading", { name: "Settings page" })).toBeTruthy();
    expect(accessGateRenders.count).toBe(1);

    await user.click(screen.getByRole("link", { name: "Audit Log" }));

    expect(window.location.pathname).toBe("/audit");
    expect(await screen.findByRole("heading", { name: "Audit page" })).toBeTruthy();
    expect(accessGateRenders.count).toBe(1);
  });

  it("preserves validated route query context during client navigation", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("link", { name: "Investigate" }));

    expect(window.location.pathname).toBe("/audit");
    expect(window.location.search).toBe("?category=connection");
    expect(await screen.findByText("?category=connection")).toBeTruthy();
  });

  it("responds to browser history popstate without a document reload", async () => {
    render(<App />);

    window.history.pushState(null, "", "/settings");
    window.dispatchEvent(new PopStateEvent("popstate"));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Settings page" })).toBeTruthy());
    expect(accessGateRenders.count).toBe(1);
  });
});
