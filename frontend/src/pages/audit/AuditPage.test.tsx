import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listActivity } from "../../features/activity/api.js";
import { AuditPage } from "./AuditPage.js";

vi.mock("../../features/activity/api.js", () => ({
  listActivity: vi.fn(),
}));

const firstEvent = {
  id: "event-1",
  timestamp: "2026-08-10T18:00:00.000Z",
  level: "warning" as const,
  category: "connection" as const,
  source: "baileys" as const,
  code: "baileys.connection.close",
  title: "WhatsApp connection closed",
  description: "The WhatsApp connection closed and may be retried.",
  metadata: {
    statusCode: 428,
    reconnect: true,
  },
};

const secondEvent = {
  id: "event-2",
  timestamp: "2026-08-10T17:59:00.000Z",
  level: "info" as const,
  category: "system" as const,
  source: "wago" as const,
  code: "gateway.started",
  title: "Gateway started",
  description: "Wago is ready.",
};

beforeEach(() => {
  window.history.replaceState({}, "", "/audit");
  vi.mocked(listActivity).mockResolvedValue({
    success: true,
    events: [firstEvent],
    nextCursor: "cursor-1",
  } as never);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AuditPage", () => {
  it("applies source, category, level, and bounded search filters automatically", async () => {
    const user = userEvent.setup();
    render(<AuditPage />);

    await screen.findByText("WhatsApp connection closed");
    expect(screen.queryByRole("button", { name: "Apply filters" })).toBeNull();

    await user.selectOptions(screen.getByLabelText("Filter audit source"), "baileys");
    await user.selectOptions(screen.getByLabelText("Filter audit category"), "connection");
    await user.selectOptions(screen.getByLabelText("Filter audit level"), "warning");
    await user.type(screen.getByLabelText("Search audit events"), "logged out");

    await waitFor(() => {
      expect(listActivity).toHaveBeenLastCalledWith({
        limit: 50,
        source: "baileys",
        category: "connection",
        level: "warning",
        q: "logged out",
      });
    });
  });

  it("loads the next cursor page without replacing already visible events", async () => {
    vi.mocked(listActivity)
      .mockResolvedValueOnce({
        success: true,
        events: [firstEvent],
        nextCursor: "cursor-1",
      } as never)
      .mockResolvedValueOnce({
        success: true,
        events: [secondEvent],
      } as never);

    const user = userEvent.setup();
    render(<AuditPage />);

    expect(await screen.findByText("WhatsApp connection closed")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Load more audit events" }));

    await waitFor(() => {
      expect(listActivity).toHaveBeenLastCalledWith({
        limit: 50,
        before: "cursor-1",
      });
    });
    expect(screen.getByText("WhatsApp connection closed")).toBeTruthy();
    expect(await screen.findByText("Gateway started")).toBeTruthy();
  });

  it("labels event source in gateway language and keeps technical metadata behind disclosure", async () => {
    const user = userEvent.setup();
    render(<AuditPage />);

    const eventTitle = await screen.findByText("WhatsApp connection closed");
    const eventRow = eventTitle.closest("article");
    expect(eventRow).toBeTruthy();
    const eventScope = within(eventRow as HTMLElement);
    expect(eventScope.getByText("WhatsApp transport")).toBeTruthy();
    expect(eventScope.getByText("Warning")).toBeTruthy();
    expect(eventScope.getByText("WhatsApp")).toBeTruthy();
    const summary = eventScope.getByText("Technical details");
    const disclosure = summary.closest("details") as HTMLDetailsElement | null;
    expect(disclosure?.open).toBe(false);

    await user.click(summary);
    expect(disclosure?.open).toBe(true);
    expect(eventScope.getByText("Status Code")).toBeTruthy();
  });
});
