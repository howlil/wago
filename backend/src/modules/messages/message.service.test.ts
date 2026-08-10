import { describe, expect, it, vi } from "vitest";
import { createMessageService } from "./message.service.js";

describe("message service", () => {
  it("delegates a send command to its injected sender", async () => {
    const sendText = vi.fn().mockResolvedValue({ messageId: "m-1", status: "pending" as const });
    const service = createMessageService({ sendText, getStatus: vi.fn() });

    const result = await service.send({ to: "6281234567890", text: "Hello", idempotencyKey: "idem-1" });

    expect(result).toEqual({ messageId: "m-1", status: "pending" });
    expect(sendText).toHaveBeenCalledWith("6281234567890", "Hello", { idempotencyKey: "idem-1" });
  });
});
