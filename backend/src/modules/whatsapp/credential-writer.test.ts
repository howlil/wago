import { describe, expect, it, vi } from "vitest";
import { createCredentialWriter } from "./credential-writer.js";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("credential writer", () => {
  it("serializes credential writes and preserves their enqueue order", async () => {
    const first = deferred();
    const calls: string[] = [];
    const writer = createCredentialWriter({
      onSuccess: vi.fn(),
      onFailure: vi.fn(),
      audit: vi.fn(),
      logFailure: vi.fn(),
    });

    writer.enqueue(async () => {
      calls.push("first:start");
      await first.promise;
      calls.push("first:end");
    }, 1);
    writer.enqueue(async () => {
      calls.push("second:start");
      calls.push("second:end");
    }, 1);

    await vi.waitFor(() => expect(calls).toEqual(["first:start"]));
    first.resolve();
    await writer.flush();

    expect(calls).toEqual(["first:start", "first:end", "second:start", "second:end"]);
  });

  it("continues the queue after a failed save and reports the next successful write", async () => {
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    const writer = createCredentialWriter({
      onSuccess,
      onFailure,
      audit: vi.fn(),
      logFailure: vi.fn(),
    });

    writer.enqueue(async () => {
      throw new Error("disk write failed");
    }, 3);
    writer.enqueue(async () => undefined, 3);

    await writer.flush();

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
