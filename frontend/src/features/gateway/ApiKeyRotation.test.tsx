import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GatewayCredentialsCard } from "./GatewayCredentialsCard.js";
import { RotateApiKeyDialog } from "./RotateApiKeyDialog.js";

const baseProps = {
  appId: "wa-gateway-test",
  apiKeyConfigured: true,
  apiKeySource: "generated" as const,
  dashboardAuthMode: "password" as const,
  signInCredential: "",
  apiKeyInput: "",
  credentialSetupRequired: false,
  isAuthenticated: true,
  showSignInCredential: false,
  showApiKey: false,
  copiedField: null,
  credentialHint: "Machine API key is configured.",
  signInHint: "Dashboard uses the admin password.",
  isSigningIn: false,
  isSigningOut: false,
  isRotatingApiKey: false,
  onSignInCredentialChange: vi.fn(),
  onToggleSignInCredential: vi.fn(),
  onToggleApiKey: vi.fn(),
  onCopyAppId: vi.fn(),
  onCopyApiKey: vi.fn(),
  onSignIn: vi.fn(),
  onSignOut: vi.fn(),
  onRotateApiKey: vi.fn(),
};

describe("API key rotation dashboard controls", () => {
  it("offers rotation only for authenticated generated credentials", async () => {
    const user = userEvent.setup();
    const onRotateApiKey = vi.fn();
    const { rerender } = render(<GatewayCredentialsCard {...baseProps} onRotateApiKey={onRotateApiKey} />);

    await user.click(screen.getByRole("button", { name: /rotate api key/i }));
    expect(onRotateApiKey).toHaveBeenCalledTimes(1);

    rerender(<GatewayCredentialsCard {...baseProps} apiKeySource="env" onRotateApiKey={onRotateApiKey} />);
    expect(screen.queryByRole("button", { name: /rotate api key/i })).toBeNull();
  });

  it("requires an explicit confirmation before rotating and revoking other sessions", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<RotateApiKeyDialog isOpen isRotating={false} onCancel={vi.fn()} onConfirm={onConfirm} />);

    expect(screen.getByRole("dialog", { name: /rotate api key/i })).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /rotate and revoke other sessions/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
