import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GatewayCredentialsCard } from "./GatewayCredentialsCard.js";

describe("first-run gateway credentials", () => {
  it("does not render deployment setup-token configuration in the credentials card", () => {
    render(
      <GatewayCredentialsCard
        appId="wa-gateway-test"
        apiKeyConfigured={false}
        apiKeySource="unset"
        apiKeyInput=""
        setupTokenInput=""
        setupTokenRequired
        webBootstrapEnabled
        credentialSetupRequired
        isAuthenticated={false}
        showApiKey={false}
        copiedField={null}
        credentialHint="Generated on first pairing."
        isSigningIn={false}
        isSigningOut={false}
        isRotatingApiKey={false}
        onApiKeyChange={vi.fn()}
        onSetupTokenChange={vi.fn()}
        onToggleApiKey={vi.fn()}
        onCopyAppId={vi.fn()}
        onCopyApiKey={vi.fn()}
        onSignIn={vi.fn()}
        onSignOut={vi.fn()}
        onRotateApiKey={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText(/deployment setup token/i)).toBeNull();
  });
});
