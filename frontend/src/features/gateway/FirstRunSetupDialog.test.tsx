import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FirstRunSetupDialog } from "./FirstRunSetupDialog.js";

describe("FirstRunSetupDialog", () => {
  it("collects the deployment-log setup code only when first pairing is authorized", async () => {
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

    expect(screen.getByRole("dialog", { name: /authorize first pairing/i })).toBeTruthy();
    expect(screen.getByLabelText(/setup code/i).getAttribute("type")).toBe("password");
    expect(screen.getByText(/deployment or container logs/i)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /continue to pairing/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
