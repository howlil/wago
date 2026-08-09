export type HealthState = "checking" | "ok" | "error";

export type Notice = {
  type: "success" | "error";
  message: string;
} | null;

export type CopiedField = "appId" | "apiKey" | null;

export type LastMessage = {
  id: string;
  status: "pending" | "accepted" | "rejected";
};
