export type ActivityLevel = "info" | "success" | "warning" | "error";
export type ActivityCategory = "system" | "security" | "connection" | "recipient" | "messaging";
export type AuditSource = "wago" | "baileys";

export type AuditMetadata = Record<string, string | number | boolean | null | undefined>;

export type AuditEvent = {
  id: string;
  timestamp: string;
  level: ActivityLevel;
  category: ActivityCategory;
  source: AuditSource;
  code: string;
  title: string;
  description: string;
  metadata?: AuditMetadata;
};

export type AuditInput = Omit<AuditEvent, "id" | "timestamp" | "source"> & {
  source?: AuditSource;
};
