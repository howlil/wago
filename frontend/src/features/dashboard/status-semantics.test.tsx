import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AccountHealthCard } from "../whatsapp/AccountHealthCard.js";
import { OverviewCards } from "./OverviewCards.js";

afterEach(() => {
  cleanup();
});

function outboundMetricScope() {
  const label = screen.getByText("Outbound");
  const metric = label.closest(".group");
  expect(metric).toBeTruthy();
  return within(metric as HTMLElement);
}

describe("operator status semantics", () => {
  it("does not show outbound Normal while WhatsApp is disconnected", () => {
    render(<OverviewCards health="ok" status="disconnected" accountHealth={{ availability: "available" }} />);

    const outbound = outboundMetricScope();
    expect(outbound.getByText("Unavailable")).toBeTruthy();
    expect(outbound.queryByText("Normal")).toBeNull();
  });

  it("does not show outbound Normal while account health is unavailable", () => {
    render(
      <OverviewCards
        health="ok"
        status="connected"
        accountHealth={{ availability: "unavailable", unavailableReason: "not_connected" }}
      />,
    );

    const outbound = outboundMetricScope();
    expect(outbound.getByText("Unavailable")).toBeTruthy();
    expect(outbound.queryByText("Normal")).toBeNull();
  });

  it("shows outbound Normal only for connected available health without restrictions", () => {
    render(<OverviewCards health="ok" status="connected" accountHealth={{ availability: "available" }} />);

    expect(outboundMetricScope().getByText("Normal")).toBeTruthy();
  });

  it("renders account health unavailable instead of optimistic defaults", () => {
    render(
      <AccountHealthCard accountHealth={{ availability: "unavailable", unavailableReason: "session_invalid" }} />,
    );

    expect(screen.getByText("Health unavailable")).toBeTruthy();
    expect(screen.getByText(/pair WhatsApp again/i)).toBeTruthy();
    expect(screen.queryByText("Available")).toBeNull();
    expect(screen.queryByText("Normal")).toBeNull();
  });

  it("renders checking health as checking rather than normal", () => {
    render(<AccountHealthCard accountHealth={{ availability: "checking" }} />);

    expect(screen.getByText("Checking account health")).toBeTruthy();
    expect(screen.queryByText("Available")).toBeNull();
    expect(screen.queryByText("Normal")).toBeNull();
  });
});
