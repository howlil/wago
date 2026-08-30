import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { IntegrationNextStep } from "./IntegrationNextStep.js";

afterEach(() => cleanup());

describe("integration next step", () => {
  it("offers Settings after WhatsApp is connected without a machine API key", () => {
    render(<IntegrationNextStep status="connected" apiKeyConfigured={false} />);

    expect(screen.getByText("Optional application integration")).toBeTruthy();
    expect(screen.getByRole("link", { name: /open settings/i }).getAttribute("href")).toBe("/settings");
  });

  it("stays out of the way when machine access is already configured", () => {
    render(<IntegrationNextStep status="connected" apiKeyConfigured />);

    expect(screen.queryByText("Optional application integration")).toBeNull();
  });

  it("does not distract from the connection flow while WhatsApp is disconnected", () => {
    render(<IntegrationNextStep status="disconnected" apiKeyConfigured={false} />);

    expect(screen.queryByText("Optional application integration")).toBeNull();
  });
});
