import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppSidebar } from "./AppSidebar.js";

afterEach(() => cleanup());

describe("AppSidebar", () => {
  it("exposes Settings as a first-class workspace destination", () => {
    render(
      <AppSidebar
        activePath="/"
        collapsed={false}
        mobileOpen={false}
        onToggleCollapsed={vi.fn()}
        onCloseMobile={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: "Control" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Audit Log" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Settings" })).toBeTruthy();
    expect(screen.getByRole("complementary").className).toContain("w-[196px]");
  });

  it("uses a 56px collapsed rail with fixed square navigation targets", () => {
    render(
      <AppSidebar activePath="/" collapsed mobileOpen={false} onToggleCollapsed={vi.fn()} onCloseMobile={vi.fn()} />,
    );

    expect(screen.getByRole("complementary").className).toContain("w-14");

    const control = screen.getByRole("link", { name: "Control" });
    expect(control.className).toContain("h-10");
    expect(control.className).toContain("w-10");
    expect(control.className).toContain("mx-auto");
  });

  it("does not render promotional self-hosted copy in the operator navigation", () => {
    render(
      <AppSidebar activePath="/" collapsed={false} mobileOpen onToggleCollapsed={vi.fn()} onCloseMobile={vi.fn()} />,
    );

    expect(screen.queryByText("Self-hosted")).toBeNull();
    expect(screen.queryByText("Your session and gateway stay under your control.")).toBeNull();
  });
});
