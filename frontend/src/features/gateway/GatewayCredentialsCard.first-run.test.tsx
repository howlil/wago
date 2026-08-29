import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GatewayCredentialsCard } from "./GatewayCredentialsCard.js";

const firstRunProps = {
  appId: "wa-gateway-test",
  apiKeyConfigured: false,
  apiKeySource: "unset" as const,
  dashboardAuthMode: "setup" as const,
  signInCredential: "",
  apiKeyInput: "",
  credentialSetupRequired: true,
  isAuthenticated: false,
  showSignInCredential: false,
  showApiKey: false,
  copiedField: null,
  credentialHint: "Generated after first pairing.",
  signInHint: "Create the first admin password here. No .env credential is required.",
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
  it("creates the admin account in the dashboard before generating the machine API key", () => {
    render(<GatewayCredentialsCard {...firstRunProps} />);

    expect(screen.getByLabelText(/admin password/i).getAttribute("placeholder")).toContain("Create a password");
    expect(screen.getByRole("button", { name: /create account/i })).toBeTruthy();
    expect(screen.getByText(/no \.env credential is required/i)).toBeTruthy();
    expect(screen.getByLabelText(/machine api key/i).getAttribute("placeholder")).toBe("Generated after first pairing");
  });
});
