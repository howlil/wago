import { requestJson } from "../../shared/api/client.js";

export type ActivityLevel = "info" | "success" | "warning" | "error";
export type ActivityCategory = "system" | "security" | "connection" | "recipient" | "messaging";
export type AuditSource = "wago" | "baileys";

export type ActivityEvent = {
  id: string;
  timestamp: string;
  level: ActivityLevel;
  category: ActivityCategory;
  source: AuditSource;
  code: string;
  title: string;
  description: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type ActivityResponse = {
  success: true;
  events: ActivityEvent[];
  nextCursor?: string;
};

export type ActivityQuery = {
  limit?: number;
  before?: string;
  source?: AuditSource;
  category?: ActivityCategory;
  level?: ActivityLevel;
  q?: string;
};

export function listActivity(query: ActivityQuery = {}): Promise<ActivityResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(query.limit ?? 100));

  if (query.before) params.set("before", query.before);
  if (query.source) params.set("source", query.source);
  if (query.category) params.set("category", query.category);
  if (query.level) params.set("level", query.level);
  if (query.q?.trim()) params.set("q", query.q.trim().slice(0, 100));

  return requestJson<ActivityResponse>(`/activity?${params.toString()}`);
}
