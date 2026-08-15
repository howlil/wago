import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GatewayCredentialsCard } from "./GatewayCredentialsCard.js";

const firstRunProps = {
  appId: "wa-gateway-test",
  apiKeyConfigured: false,
  apiKeySource: "unset" as const,
  apiKeyInput: "",
  credentialSetupRequired: true,
  isAuthenticated: false,
  showApiKey: false,
  copiedField: null,
  credentialHint: "Generated on first pairing.",
  isSigningIn: false,
  isSigningOut: false,
  isRotatingApiKey: false,
  onApiKeyChange: vi.fn(),
  onToggleApiKey: vi.fn(),
  onCopyAppId: vi.fn(),
  onCopyApiKey: vi.fn(),
  onSignIn: vi.fn(),
  onSignOut: vi.fn(),
  onRotateApiKey: vi.fn(),
};

describe("first-run gateway credentials", () => {
  it("keeps deployment setup authorization out of the permanent credentials card", () => {
    render(<GatewayCredentialsCard {...firstRunProps} />);

    expect(screen.queryByLabelText(/deployment setup token/i)).toBeNull();
    expect(screen.getByLabelText(/api key/i).getAttribute("placeholder")).toBe("Generated on first pairing");
  });
});
