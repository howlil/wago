import { DisconnectReason } from "@whiskeysockets/baileys";
import { describe, expect, it } from "vitest";
import { classifyDisconnect } from "./disconnect-classifier.js";

describe("classifyDisconnect", () => {
  it("treats logged out as terminal and non-reconnectable", () => {
    expect(
      classifyDisconnect({
        statusCode: DisconnectReason.loggedOut,
        rebindInProgress: false,
        shuttingDown: false,
      }),
    ).toEqual({
      statusCode: DisconnectReason.loggedOut,
      reason: "logged_out",
      terminal: true,
      shouldReconnect: false,
    });
  });

  it("keeps an ordinary connection close recoverable", () => {
    expect(
      classifyDisconnect({
        statusCode: DisconnectReason.connectionClosed,
        rebindInProgress: false,
        shuttingDown: false,
      }),
    ).toMatchObject({
      statusCode: DisconnectReason.connectionClosed,
      reason: "connection_closed",
      terminal: false,
      shouldReconnect: true,
    });
  });

  it("never reconnects during rebind or shutdown", () => {
    expect(
      classifyDisconnect({
        statusCode: undefined,
        rebindInProgress: true,
        shuttingDown: false,
      }).shouldReconnect,
    ).toBe(false);

    expect(
      classifyDisconnect({
        statusCode: undefined,
        rebindInProgress: false,
        shuttingDown: true,
      }).shouldReconnect,
    ).toBe(false);
  });

  it("keeps unknown disconnect reasons explicit and recoverable by default", () => {
    expect(
      classifyDisconnect({
        statusCode: 599,
        rebindInProgress: false,
        shuttingDown: false,
      }),
    ).toEqual({
      statusCode: 599,
      reason: "status_599",
      terminal: false,
      shouldReconnect: true,
    });
  });
});
