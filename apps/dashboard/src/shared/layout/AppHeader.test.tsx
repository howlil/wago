import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "./AppHeader.js";

afterEach(() => cleanup());

describe("AppHeader", () => {
  it("renders page identity and page-level actions without routine status chrome", () => {
    render(<AppHeader title="Control" onRefresh={vi.fn()} onOpenMobileNav={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Control" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeTruthy();
    expect(screen.queryByText("Disconnected")).toBeNull();
    expect(screen.queryByText(/Manage connection/i)).toBeNull();
  });
});
