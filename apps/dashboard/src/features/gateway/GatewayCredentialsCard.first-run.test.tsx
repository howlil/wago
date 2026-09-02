import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GatewayCredentialsCard } from "./GatewayCredentialsCard.js";

const gatewayProps = {
  appId: "wa-gateway-test",
  apiKeyConfigured: false,
  apiKeyInput: "",
  showApiKey: false,
  copiedField: null,
  credentialHint: "Optional. Generate a machine API key only for external REST clients.",
  isGeneratingApiKey: false,
  isRotatingApiKey: false,
  onToggleApiKey: vi.fn(),
  onCopyAppId: vi.fn(),
  onCopyApiKey: vi.fn(),
  onGenerateApiKey: vi.fn(),
  onRotateApiKey: vi.fn(),
};

describe("gateway credentials", () => {
  it("shows machine access as a state instead of an empty credential form", () => {
    render(<GatewayCredentialsCard {...gatewayProps} />);

    expect(screen.queryByLabelText(/admin password/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /^sign out$/i })).toBeNull();
    expect(screen.getByText("Not generated")).toBeTruthy();
    expect(screen.queryByLabelText(/machine api key/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /^copy key$/i })).toBeNull();
    expect(screen.getByRole("button", { name: /generate api key/i })).toBeTruthy();
  });
});
