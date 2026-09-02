import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AccountHealthCard } from "../whatsapp/AccountHealthCard.js";
import { OverviewCards } from "./OverviewCards.js";

afterEach(() => {
  cleanup();
});

function messagingMetricScope() {
  return within(screen.getByRole("region", { name: "Messaging status" }));
}

describe("operator status semantics", () => {
  it("shows messaging as a dependency state rather than a second alarm while WhatsApp is disconnected", () => {
    render(<OverviewCards health="ok" status="disconnected" accountHealth={{ availability: "available" }} />);

    const messaging = messagingMetricScope();
    expect(messaging.getByText("Waiting")).toBeTruthy();
    expect(messaging.getByText("Requires WhatsApp")).toBeTruthy();
    expect(messaging.queryByText("Normal")).toBeNull();
  });

  it("does not show messaging Normal while account health is unavailable", () => {
    render(
      <OverviewCards
        health="ok"
        status="connected"
        accountHealth={{ availability: "unavailable", unavailableReason: "not_connected" }}
      />,
    );

    const messaging = messagingMetricScope();
    expect(messaging.getByText("Waiting")).toBeTruthy();
    expect(messaging.queryByText("Normal")).toBeNull();
  });

  it("shows messaging Normal only for connected available health without restrictions", () => {
    render(<OverviewCards health="ok" status="connected" accountHealth={{ availability: "available" }} />);

    expect(messagingMetricScope().getByText("Normal")).toBeTruthy();
  });

  it("renders account health unavailable instead of optimistic defaults", () => {
    render(<AccountHealthCard accountHealth={{ availability: "unavailable", unavailableReason: "session_invalid" }} />);

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
