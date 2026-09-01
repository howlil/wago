import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { apiEndpoints } from "./endpoint-catalog.ts";
import { buildLiveRequest, buildSnippet } from "./request-builder.ts";

function endpoint(id: string) {
  const result = apiEndpoints.find((item) => item.id === id);
  assert.ok(result, `Missing endpoint ${id}`);
  return result;
}

describe("API explorer request builder", () => {
  it("URL-encodes path parameters", () => {
    const request = buildLiveRequest({
      endpoint: endpoint("recipient-opt-out"),
      baseUrl: "https://wago.example.com/",
      apiKey: "wa_super_secret",
      values: { phone: "+62 812/34" },
    });

    assert.equal(request.url, "https://wago.example.com/recipients/%2B62%20812%2F34/opt-out");
  });

  it("omits blank query parameters", () => {
    const request = buildLiveRequest({
      endpoint: endpoint("activity-list"),
      baseUrl: "https://wago.example.com",
      apiKey: "wa_super_secret",
      values: { source: "baileys", category: "", q: "", limit: "25" },
    });

    assert.equal(request.url, "https://wago.example.com/activity?source=baileys&limit=25");
  });

  it("adds Bearer auth only to live protected requests", () => {
    const protectedRequest = buildLiveRequest({
      endpoint: endpoint("whatsapp-status"),
      baseUrl: "https://wago.example.com",
      apiKey: "wa_super_secret",
      values: {},
    });
    const publicRequest = buildLiveRequest({
      endpoint: endpoint("health"),
      baseUrl: "https://wago.example.com",
      apiKey: "wa_super_secret",
      values: {},
    });

    assert.equal(new Headers(protectedRequest.init.headers).get("Authorization"), "Bearer wa_super_secret");
    assert.equal(new Headers(publicRequest.init.headers).get("Authorization"), null);
  });

  it("never emits the real API key in generated snippets", () => {
    const snippet = buildSnippet({
      endpoint: endpoint("whatsapp-status"),
      baseUrl: "https://wago.example.com",
      values: {},
      language: "curl",
    });

    assert.match(snippet, /YOUR_API_KEY/);
    assert.doesNotMatch(snippet, /wa_super_secret/);
  });

  it("does not attach a JSON body to GET", () => {
    const request = buildLiveRequest({
      endpoint: endpoint("activity-list"),
      baseUrl: "https://wago.example.com",
      apiKey: "wa_super_secret",
      values: { limit: "20" },
    });

    assert.equal(request.init.body, undefined);
    assert.equal(new Headers(request.init.headers).get("Content-Type"), null);
  });

  it("uses Idempotency-Key header for message send", () => {
    const request = buildLiveRequest({
      endpoint: endpoint("message-send"),
      baseUrl: "https://wago.example.com",
      apiKey: "wa_super_secret",
      values: { to: "6281234567890", text: "Hello", idempotencyKey: "sop-123" },
    });

    assert.equal(new Headers(request.init.headers).get("Idempotency-Key"), "sop-123");
    assert.equal(request.init.body, JSON.stringify({ to: "6281234567890", text: "Hello" }));
  });
});
