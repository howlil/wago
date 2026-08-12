import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { apiEndpoints, requiresLiveConfirmation } from "./endpoint-catalog.ts";

const routes = [
  "GET /health",
  "GET /ready",
  "GET /app/info",
  "POST /app/bootstrap",
  "GET /activity",
  "GET /recipients",
  "POST /recipients/allow",
  "POST /recipients/:phone/opt-out",
  "GET /whatsapp/status",
  "GET /whatsapp/qr",
  "GET /whatsapp/qr/image",
  "POST /whatsapp/pair",
  "POST /whatsapp/rebind",
  "POST /messages/send",
  "GET /messages/:id/status",
  "GET /webhooks/deliveries",
  "GET /webhooks/deliveries/:id",
  "POST /webhooks/deliveries/:id/redeliver",
];

describe("API endpoint catalog", () => {
  it("contains every current public route exactly once", () => {
    const actual = apiEndpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`);
    assert.deepEqual(actual.toSorted(), routes.toSorted());
    assert.equal(new Set(actual).size, actual.length);
  });

  it("requires confirmation for every POST endpoint", () => {
    assert.equal(apiEndpoints.filter((endpoint) => endpoint.method === "POST").every(requiresLiveConfirmation), true);
  });

  it("marks rebind as the high-danger action", () => {
    const rebind = apiEndpoints.find((endpoint) => endpoint.id === "whatsapp-rebind");
    assert.equal(rebind?.danger, "high");
  });
});
