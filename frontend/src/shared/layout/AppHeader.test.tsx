import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "./AppHeader.js";

afterEach(() => cleanup());

describe("AppHeader", () => {
  it("renders the page title without a redundant Gateway badge", () => {
    render(
      <AppHeader
        title="Control"
        description="Manage connection, access and outbound messaging."
        statusLabel="Disconnected"
        statusTone="neutral"
        onRefresh={vi.fn()}
        onOpenMobileNav={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Control" })).toBeTruthy();
    expect(screen.queryByText("Gateway", { selector: "span" })).toBeNull();
  });
});
