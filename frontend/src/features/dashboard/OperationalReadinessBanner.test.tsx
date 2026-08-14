import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OperationalReadinessBanner } from "./OperationalReadinessBanner.js";

const degradedReadiness = {
  status: "degraded" as const,
  checks: {
    credentialPersistence: {
      status: "degraded" as const,
      reason: "credential_persistence_failed",
    },
  },
};

describe("OperationalReadinessBanner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders supplied readiness state without owning a polling interval", () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    render(<OperationalReadinessBanner readiness={degradedReadiness} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/credential updates are not persisting/i);
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });
});
