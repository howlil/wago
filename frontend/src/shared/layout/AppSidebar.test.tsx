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
  });

  it("uses fixed square navigation targets in collapsed mode", () => {
    render(
      <AppSidebar
        activePath="/"
        collapsed
        mobileOpen={false}
        onToggleCollapsed={vi.fn()}
        onCloseMobile={vi.fn()}
      />,
    );

    const control = screen.getByRole("link", { name: "Control" });
    expect(control.className).toContain("h-10");
    expect(control.className).toContain("w-10");
    expect(control.className).toContain("mx-auto");
  });
});
