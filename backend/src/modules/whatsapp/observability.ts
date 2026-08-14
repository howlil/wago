import type { WASocket } from "@whiskeysockets/baileys";
import { type BaileysAuditInput, recordBaileysAudit } from "../../activity/baileys-audit.js";
import { logger } from "../../infrastructure/logger.js";
import type { AccountHealthFetcher } from "./account-health.js";

export function auditBaileys(input: BaileysAuditInput): void {
  void recordBaileysAudit(input).catch((error) => {
    logger.warn({ event: "wa.audit.persist_failed", error }, "Failed to persist Baileys audit event");
  });
}

export function auditDate(value: Date | string | undefined): string | null {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

export function createAccountHealthFetcher(activeSocket: WASocket, generation: number): AccountHealthFetcher {
  return {
    fetchAccountReachoutTimelock: async () => {
      try {
        const state = await activeSocket.fetchAccountReachoutTimelock();
        auditBaileys({
          level: state?.isActive ? "warning" : "info",
          category: "connection",
          code: "baileys.health.reachout_timelock",
          title: "Reach-out health checked",
          description: "WhatsApp reach-out restriction state was refreshed.",
          metadata: {
            socketGeneration: generation,
            active: Boolean(state?.isActive),
            retryAt: auditDate(state?.timeEnforcementEnds),
            enforcementType: state?.enforcementType ?? null,
          },
        });
        return state;
      } catch (error) {
        auditBaileys({
          level: "warning",
          category: "connection",
          code: "baileys.health.fetch_failed",
          title: "Account health check failed",
          description: "WhatsApp reach-out health could not be refreshed.",
          metadata: {
            socketGeneration: generation,
            operation: "reachout_timelock",
            errorName: error instanceof Error ? error.name : "UNKNOWN",
          },
        });
        throw error;
      }
    },
    fetchNewChatMessageCap: async () => {
      try {
        const cap = await activeSocket.fetchNewChatMessageCap();
        auditBaileys({
          level: cap?.capping_status === "CAPPED" ? "warning" : "info",
          category: "connection",
          code: "baileys.health.new_chat_cap",
          title: "New-chat cap checked",
          description: "WhatsApp new-chat capacity state was refreshed.",
          metadata: {
            socketGeneration: generation,
            cappingStatus: cap?.capping_status ?? null,
            totalQuota: cap?.total_quota ?? null,
            usedQuota: cap?.used_quota ?? null,
          },
        });
        return cap;
      } catch (error) {
        auditBaileys({
          level: "warning",
          category: "connection",
          code: "baileys.health.fetch_failed",
          title: "Account health check failed",
          description: "WhatsApp new-chat capacity could not be refreshed.",
          metadata: {
            socketGeneration: generation,
            operation: "new_chat_cap",
            errorName: error instanceof Error ? error.name : "UNKNOWN",
          },
        });
        throw error;
      }
    },
  };
}
