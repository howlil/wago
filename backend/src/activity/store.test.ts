import { afterEach, describe, expect, it } from "vitest";
import { listActivity, recordActivity, resetActivityLogForTest } from "./store.js";

describe("activity store", () => {
  afterEach(async () => {
    await resetActivityLogForTest();
  });

  it("stores newest events first", async () => {
    await recordActivity({
      level: "info",
      category: "system",
      code: "first",
      title: "First",
      description: "First event",
    });
    await recordActivity({
      level: "success",
      category: "connection",
      code: "second",
      title: "Second",
      description: "Second event",
    });

    const events = await listActivity(2);

    expect(events).toHaveLength(2);
    expect(events[0]?.code).toBe("second");
    expect(events[1]?.code).toBe("first");
  });

  it("redacts sensitive metadata before persistence", async () => {
    await recordActivity({
      level: "warning",
      category: "messaging",
      code: "message.blocked",
      title: "Message blocked",
      description: "Outbound policy blocked a message.",
      metadata: {
        targetPhone: "6281234567890",
        apiKey: "secret",
      },
    });

    const [event] = await listActivity(1);

    expect(event?.metadata?.targetPhone).not.toBe("6281234567890");
    expect(event?.metadata?.apiKey).toBe("[REDACTED]");
  });
});
