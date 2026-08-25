import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FirstRunSetupDialog } from "./FirstRunSetupDialog.js";

describe("FirstRunSetupDialog", () => {
  it("collects SETUP_TOKEN only for the legacy bootstrap compatibility path", async () => {
    const user = userEvent.setup();
    const onSetupCodeChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <FirstRunSetupDialog
        isOpen
        setupCode="setup_example"
        isSubmitting={false}
        onSetupCodeChange={onSetupCodeChange}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole("dialog", { name: /legacy setup authorization/i })).toBeTruthy();
    expect(screen.getByLabelText(/setup_token/i).getAttribute("type")).toBe("password");
    expect(screen.getByText(/new deployments should configure wago_admin_password/i)).toBeTruthy();
    expect(screen.queryByText(/deployment or container logs/i)).toBeNull();

    await user.click(screen.getByRole("button", { name: /continue to pairing/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
