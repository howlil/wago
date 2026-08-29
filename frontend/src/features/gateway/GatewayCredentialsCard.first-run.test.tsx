import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GatewayCredentialsCard } from "./GatewayCredentialsCard.js";

const firstRunProps = {
  appId: "wa-gateway-test",
  apiKeyConfigured: false,
  apiKeySource: "unset" as const,
  dashboardAuthMode: "password" as const,
  signInCredential: "",
  apiKeyInput: "",
  credentialSetupRequired: true,
  isAuthenticated: false,
  showSignInCredential: false,
  showApiKey: false,
  copiedField: null,
  credentialHint: "Generated after first pairing.",
  signInHint: "Use WAGO_ADMIN_PASSWORD.",
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

describe("first-run gateway credentials", () => {
  it("shows admin-password access separately from the generated machine API key", () => {
    render(<GatewayCredentialsCard {...firstRunProps} />);

    expect(screen.getByLabelText(/admin password/i)).toBeTruthy();
    expect(screen.getByLabelText(/machine api key/i).getAttribute("placeholder")).toBe("Generated after first pairing");
  });
});
