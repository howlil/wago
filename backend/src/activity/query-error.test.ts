import { describe, expect, it } from "vitest";
import { ApplicationError } from "../errors/application-error.js";
import { listAudit } from "./query.js";

describe("audit query typed errors", () => {
  it("rejects malformed cursors with a typed application error", async () => {
    const promise = listAudit({ limit: 20, before: "not-a-valid-cursor" });

    await expect(promise).rejects.toBeInstanceOf(ApplicationError);
    await expect(promise).rejects.toMatchObject({
      name: "ApplicationError",
      code: "INVALID_AUDIT_CURSOR",
      message: "Audit cursor is invalid",
    });
  });
});
