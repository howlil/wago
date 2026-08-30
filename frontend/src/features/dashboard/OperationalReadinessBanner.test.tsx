import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OperationalReadinessBanner } from "./OperationalReadinessBanner.js";

afterEach(() => {
  cleanup();
});

describe("OperationalReadinessBanner", () => {
  it("links degraded connection state directly to filtered Audit evidence", () => {
    render(
      <OperationalReadinessBanner
        readiness={{
          status: "degraded",
          checks: {
            whatsapp: { status: "degraded", reason: "bound_session_disconnected" },
          },
        }}
      />,
    );

    const link = screen.getByRole("link", { name: /investigate in audit/i });
    expect(link.getAttribute("href")).toBe("/audit?category=connection&level=warning");
  });

  it("stays hidden while readiness is healthy", () => {
    const { container } = render(
      <OperationalReadinessBanner
        readiness={{
          status: "ok",
          checks: {
            gateway: { status: "ok" },
          },
        }}
      />,
    );

    expect(container.innerHTML).toBe("");
  });
});
