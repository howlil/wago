import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatExplorerResponse } from "./response-format.ts";

describe("API explorer response formatter", () => {
  it("pretty prints JSON responses", async () => {
    const response = new Response(JSON.stringify({ success: true, status: "ok" }), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
    const result = await formatExplorerResponse(response);

    assert.equal(result.contentType, "application/json; charset=utf-8");
    assert.match(result.body, /"success": true/);
    assert.match(result.body, /\n/);
  });

  it("falls back to plain text", async () => {
    const response = new Response("service unavailable", {
      headers: { "Content-Type": "text/plain" },
    });
    const result = await formatExplorerResponse(response);

    assert.equal(result.contentType, "text/plain");
    assert.equal(result.body, "service unavailable");
  });
});
