import { requestJson } from "../../shared/api/client.js";

export type RecipientRecord = {
  jid: string;
  label?: string;
  allowed: boolean;
  optedOut: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RecipientsResponse = {
  success: true;
  recipients: RecipientRecord[];
};

export type RecipientMutationResponse =
  | {
      success: true;
      recipient: RecipientRecord;
    }
  | {
      success: false;
      error: string;
      message: string;
    };

export function listRecipients(): Promise<RecipientsResponse> {
  return requestJson<RecipientsResponse>("/recipients");
}

export function allowRecipient(phone: string, label?: string): Promise<RecipientMutationResponse> {
  return requestJson<RecipientMutationResponse>("/recipients/allow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, ...(label?.trim() ? { label: label.trim() } : {}) }),
  });
}

export function optOutRecipient(phone: string): Promise<RecipientMutationResponse> {
  return requestJson<RecipientMutationResponse>("/recipients/opt-out", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
}
