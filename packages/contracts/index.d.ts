export type WhatsAppStatus = "connecting" | "qr" | "connected" | "disconnected";

export type WhatsAppBinding =
  | {
      state: "unbound";
      jid: null;
      phone: null;
      boundAt: null;
    }
  | {
      state: "bound";
      jid: string;
      phone: string;
      boundAt: string;
    };

export type AccountHealthAvailability = "unavailable" | "checking" | "available";
export type AccountHealthUnavailableReason = "not_connected" | "session_invalid" | "fetch_failed";
export type NewChatCapacityStatus = "unknown" | "healthy" | "warning" | "capped";

export type AccountHealthSnapshot = {
  availability: AccountHealthAvailability;
  unavailableReason?: AccountHealthUnavailableReason;
  reachoutTimeLock?: {
    isActive: boolean;
    retryAt?: string;
    enforcementType?: string;
  };
  newChatCapacity: {
    status: NewChatCapacityStatus;
    used?: number;
    total?: number;
    cycleStartAt?: string;
    cycleEndAt?: string;
  };
  lastFetchedAt?: string;
  lastFetchErrorAt?: string;
};

export type WhatsAppStatusSnapshot = {
  status: WhatsAppStatus;
  binding: WhatsAppBinding;
  accountHealth: AccountHealthSnapshot;
};

export type WhatsAppStatusResponse = WhatsAppStatusSnapshot & { success: true };
export type QrResponse = {
  success: true;
  qr: string | null;
  status: WhatsAppStatus;
  message?: string;
};
export type PairingResponse = {
  success: true;
  message: string;
  status: WhatsAppStatus;
};

export type WebhookDeliveryStatus = "pending" | "delivering" | "delivered" | "failed" | "expired";
export type WebhookAttemptOutcome =
  | "in_progress"
  | "succeeded"
  | "retryable_failure"
  | "permanent_failure"
  | "interrupted";

export type WebhookDelivery = {
  id: string;
  event: string;
  messageId: string;
  status: WebhookDeliveryStatus;
  attemptCount: number;
  redeliveryCount: number;
  nextAttemptAt: string | null;
  firstAttemptAt: string | null;
  lastAttemptAt: string | null;
  lastStatusCode: number | null;
  lastErrorCode: string | null;
  createdAt: string;
  deliveredAt: string | null;
  expiresAt: string;
  claimedAt: string | null;
  redeliveryAvailable: boolean;
};

export type WebhookDeliveryAttempt = {
  sequence: number;
  redeliveryNumber: number;
  outcome: WebhookAttemptOutcome;
  startedAt: string;
  completedAt: string | null;
  statusCode: number | null;
  errorCode: string | null;
  retryable: boolean | null;
  nextAttemptAt: string | null;
};

export type WebhookDeliveryDetail = WebhookDelivery & {
  attempts: WebhookDeliveryAttempt[];
};

export type MessageDeliveryStatus = "pending" | "accepted" | "rejected";
export type MessageDispatchState = "prepared" | "submitting" | "submitted" | "indeterminate";
export type MessageDeliveryEvidence = "submitted" | "server_accepted" | "delivered" | "read" | "played";
export type MessageMediaKind = "image" | "video" | "audio" | "document";

export type MessageStatusResponse = {
  success: true;
  id: string;
  to: string;
  status: MessageDeliveryStatus;
  deliveryEvidence?: MessageDeliveryEvidence;
  error?: string;
  message?: string;
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
  rejectedAt?: string;
  serverAcceptedAt?: string;
  deliveredAt?: string;
  readAt?: string;
  playedAt?: string;
};

export type MessageDiagnosticResponse = Omit<MessageStatusResponse, "to"> & {
  dispatchState: MessageDispatchState;
  webhook: Pick<
    WebhookDelivery,
    | "id"
    | "event"
    | "status"
    | "attemptCount"
    | "redeliveryCount"
    | "lastStatusCode"
    | "lastErrorCode"
    | "createdAt"
    | "lastAttemptAt"
    | "deliveredAt"
  > | null;
};
