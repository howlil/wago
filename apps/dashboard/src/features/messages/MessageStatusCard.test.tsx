import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMessageDiagnostics: vi.fn(),
}));

vi.mock("./api.js", () => ({
  getMessageDiagnostics: mocks.getMessageDiagnostics,
}));

import { MessageStatusCard } from "./MessageStatusCard.js";

afterEach(() => {
  cleanup();
  mocks.getMessageDiagnostics.mockReset();
});

describe("MessageStatusCard", () => {
  it("shows indeterminate transport state without presenting it as a delivery rejection", async () => {
    mocks.getMessageDiagnostics.mockResolvedValue({
      success: true,
      id: "message-1",
      status: "pending",
      dispatchState: "indeterminate",
      createdAt: "2026-08-30T12:00:00.000Z",
      updatedAt: "2026-08-30T12:00:01.000Z",
      webhook: null,
    });
    const user = userEvent.setup();

    render(<MessageStatusCard messageId="message-1" initialStatus="pending" />);
    await user.click(screen.getByRole("button", { name: /refresh/i }));

    expect(await screen.findByText("Indeterminate")).toBeTruthy();
    expect(screen.getByText(/will not be retried automatically/i)).toBeTruthy();
    expect(screen.getByText("pending", { exact: false })).toBeTruthy();
  });
});
