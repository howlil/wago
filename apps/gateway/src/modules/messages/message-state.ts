import type { MessageDeliveryEvidence, MessageDeliveryStatus, MessageDispatchState } from "@wago/contracts";

export type { MessageDeliveryEvidence, MessageDeliveryStatus, MessageDispatchState };

export type MessageDispatchEvent = "submission_started" | "submission_succeeded" | "submission_ambiguous";

const dispatchTransitions: Record<MessageDispatchEvent, Partial<Record<MessageDispatchState, MessageDispatchState>>> = {
  submission_started: { prepared: "submitting" },
  submission_succeeded: { submitting: "submitted" },
  submission_ambiguous: { submitting: "indeterminate" },
};

const evidenceRank: Record<MessageDeliveryEvidence, number> = {
  submitted: 0,
  server_accepted: 1,
  delivered: 2,
  read: 3,
  played: 4,
};

export function nextMessageDispatchState(
  current: MessageDispatchState,
  event: MessageDispatchEvent,
): MessageDispatchState | null {
  return dispatchTransitions[event][current] ?? null;
}

export function canAdvanceMessageDeliveryEvidence(
  current: MessageDeliveryEvidence | undefined,
  next: MessageDeliveryEvidence,
): boolean {
  return current === undefined || evidenceRank[next] > evidenceRank[current];
}

export function canSetTerminalMessageStatus(
  current: MessageDeliveryStatus,
  next: Exclude<MessageDeliveryStatus, "pending">,
): boolean {
  return current === "pending" && (next === "accepted" || next === "rejected");
}
