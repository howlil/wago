import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../ui/tooltip.js";
import { AppSidebar } from "./AppSidebar.js";

function renderSidebar(props: Partial<ComponentProps<typeof AppSidebar>> = {}) {
  return render(
    <TooltipProvider delayDuration={0}>
      <AppSidebar
        activePath={props.activePath ?? "/"}
        collapsed={props.collapsed ?? false}
        mobileOpen={props.mobileOpen ?? false}
        onToggleCollapsed={props.onToggleCollapsed ?? vi.fn()}
        onCloseMobile={props.onCloseMobile ?? vi.fn()}
      />
    </TooltipProvider>,
  );
}

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
});

describe("AppSidebar", () => {
  it("exposes Settings as a first-class workspace destination", () => {
    renderSidebar();

    expect(screen.getByRole("link", { name: "Control" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Audit Log" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Settings" })).toBeTruthy();
    expect(screen.getByRole("complementary").className).toContain("w-[196px]");
  });

  it("uses a 56px collapsed rail with fixed square navigation targets", () => {
    renderSidebar({ collapsed: true });

    expect(screen.getByRole("complementary").className).toContain("w-14");

    const control = screen.getByRole("link", { name: "Control" });
    expect(control.className).toContain("h-10");
    expect(control.className).toContain("w-10");
    expect(control.className).toContain("mx-auto");
  });

  it("provides a focus tooltip when collapsed navigation hides its label", async () => {
    renderSidebar({ collapsed: true });

    const control = screen.getByRole("link", { name: "Control" });
    expect(control.getAttribute("title")).toBeNull();

    control.focus();
    expect((await screen.findByRole("tooltip")).textContent).toContain("Control");
  });

  it("exposes mobile navigation as a labeled dialog", () => {
    renderSidebar({ mobileOpen: true });

    const navigationSheet = screen.getByRole("dialog", { name: "Navigation" });
    expect(within(navigationSheet).getByRole("navigation", { name: "Mobile application navigation" })).toBeTruthy();
    expect(within(navigationSheet).getByRole("link", { name: "Settings" })).toBeTruthy();
  });

  it("routes Escape dismissal through the mobile navigation boundary", async () => {
    const user = userEvent.setup();
    const onCloseMobile = vi.fn();
    renderSidebar({ mobileOpen: true, onCloseMobile });

    await user.keyboard("{Escape}");
    expect(onCloseMobile).toHaveBeenCalledTimes(1);
  });

  it("routes the close control through the mobile navigation boundary", async () => {
    const user = userEvent.setup();
    const onCloseMobile = vi.fn();
    renderSidebar({ mobileOpen: true, onCloseMobile });

    const navigationSheet = screen.getByRole("dialog", { name: "Navigation" });
    await user.click(within(navigationSheet).getByRole("button", { name: "Close sidebar" }));
    expect(onCloseMobile).toHaveBeenCalledTimes(1);
  });

  it("does not render promotional self-hosted copy in the operator navigation", () => {
    renderSidebar({ mobileOpen: true });

    expect(screen.queryByText("Self-hosted")).toBeNull();
    expect(screen.queryByText("Your session and gateway stay under your control.")).toBeNull();
  });
});
