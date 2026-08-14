import { DisconnectReason } from "@whiskeysockets/baileys";

export type DisconnectClassification = {
  statusCode?: number;
  reason: string;
  terminal: boolean;
  shouldReconnect: boolean;
};

function mapDisconnectReason(statusCode: number | undefined): string {
  if (statusCode == null) {
    return "unknown";
  }

  if (statusCode === DisconnectReason.loggedOut) {
    return "logged_out";
  }
  if (statusCode === DisconnectReason.connectionClosed) {
    return "connection_closed";
  }
  if (statusCode === DisconnectReason.connectionLost || statusCode === DisconnectReason.timedOut) {
    return "connection_lost_or_timed_out";
  }
  if (statusCode === DisconnectReason.restartRequired) {
    return "restart_required";
  }
  if (statusCode === DisconnectReason.badSession) {
    return "bad_session";
  }
  if (statusCode === DisconnectReason.connectionReplaced) {
    return "connection_replaced";
  }
  if (statusCode === DisconnectReason.multideviceMismatch) {
    return "multidevice_mismatch";
  }
  if (statusCode === DisconnectReason.forbidden) {
    return "forbidden";
  }
  if (statusCode === DisconnectReason.unavailableService) {
    return "unavailable_service";
  }

  return `status_${statusCode}`;
}

export function classifyDisconnect(input: {
  statusCode?: number;
  rebindInProgress: boolean;
  shuttingDown: boolean;
}): DisconnectClassification {
  const terminal = input.statusCode === DisconnectReason.loggedOut;

  return {
    statusCode: input.statusCode,
    reason: mapDisconnectReason(input.statusCode),
    terminal,
    shouldReconnect: !terminal && !input.rebindInProgress && !input.shuttingDown,
  };
}
