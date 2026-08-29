import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GatewayCredentialsCard } from "./GatewayCredentialsCard.js";

const gatewayProps = {
  appId: "wa-gateway-test",
  apiKeyConfigured: false,
  apiKeySource: "unset" as const,
  apiKeyInput: "",
  credentialSetupRequired: true,
  showApiKey: false,
  copiedField: null,
  credentialHint: "Generated after first pairing.",
  isSigningOut: false,
  isRotatingApiKey: false,
  onToggleApiKey: vi.fn(),
  onCopyAppId: vi.fn(),
  onCopyApiKey: vi.fn(),
  onSignOut: vi.fn(),
  onRotateApiKey: vi.fn(),
};

describe("gateway credentials", () => {
  it("keeps dashboard authentication out of the machine-credential card", () => {
    render(<GatewayCredentialsCard {...gatewayProps} />);

    expect(screen.queryByLabelText(/admin password/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /create account/i })).toBeNull();
    expect(screen.getByLabelText(/machine api key/i).getAttribute("placeholder")).toBe("Generated after first pairing");
    expect(screen.getByRole("button", { name: /^sign out$/i })).toBeTruthy();
  });
});
