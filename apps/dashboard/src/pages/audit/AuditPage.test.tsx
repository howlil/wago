import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listActivity } from "../../features/activity/api.js";
import { TooltipProvider } from "../../shared/ui/tooltip.js";
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

function renderAuditPage() {
  return render(
    <TooltipProvider delayDuration={0} skipDelayDuration={0}>
      <AuditPage />
    </TooltipProvider>,
  );
}

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
  it("uses troubleshooting query params as initial filters", async () => {
    window.history.replaceState({}, "", "/audit?category=connection&level=warning");

    renderAuditPage();

    await waitFor(() => {
      expect(listActivity).toHaveBeenCalledWith({
        limit: 50,
        category: "connection",
        level: "warning",
      });
    });
    expect((screen.getByLabelText("Filter audit category") as HTMLSelectElement).value).toBe("connection");
    expect((screen.getByLabelText("Filter audit level") as HTMLSelectElement).value).toBe("warning");
  });

  it("ignores unsupported troubleshooting query params", async () => {
    window.history.replaceState({}, "", "/audit?category=internal&level=critical");

    renderAuditPage();

    await waitFor(() => {
      expect(listActivity).toHaveBeenCalledWith({ limit: 50 });
    });
    expect((screen.getByLabelText("Filter audit category") as HTMLSelectElement).value).toBe("all");
    expect((screen.getByLabelText("Filter audit level") as HTMLSelectElement).value).toBe("all");
  });

  it("applies source, category, level, and bounded search filters automatically", async () => {
    const user = userEvent.setup();
    renderAuditPage();

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
    renderAuditPage();

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
    renderAuditPage();

    const eventTitle = await screen.findByText("WhatsApp connection closed");
    const eventRow = eventTitle.closest("article");
    expect(eventRow).toBeTruthy();
    const eventScope = within(eventRow as HTMLElement);
    expect(eventScope.getByText("WhatsApp transport")).toBeTruthy();
    expect(eventScope.getByText("Warning")).toBeTruthy();
    expect(eventScope.getByText("WhatsApp")).toBeTruthy();

    const disclosure = eventScope.getByRole("button", { name: "Technical details" });
    expect(disclosure.getAttribute("aria-expanded")).toBe("false");
    expect(eventScope.queryByText("Status Code")).toBeNull();

    await user.click(disclosure);
    expect(disclosure.getAttribute("aria-expanded")).toBe("true");
    expect(eventScope.getByText("Status Code")).toBeTruthy();
    expect(eventScope.getByText("428")).toBeTruthy();

    await user.click(disclosure);
    expect(disclosure.getAttribute("aria-expanded")).toBe("false");
    await waitFor(() => expect(eventScope.queryByText("Status Code")).toBeNull());
  });
});
