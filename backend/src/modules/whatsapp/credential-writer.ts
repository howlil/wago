import type { BaileysAuditInput } from "../../activity/baileys-audit.js";

const CREDENTIAL_AUDIT_INTERVAL_MS = 1000 * 60;

type CredentialWriterDependencies = {
  onSuccess: () => void;
  onFailure: () => void;
  audit: (input: BaileysAuditInput) => void;
  logFailure: (error: unknown) => void;
  now?: () => number;
};

export function createCredentialWriter({
  onSuccess,
  onFailure,
  audit,
  logFailure,
  now = Date.now,
}: CredentialWriterDependencies) {
  let queue: Promise<void> = Promise.resolve();
  let lastSuccessAuditGeneration = 0;
  let lastSuccessAuditAt = 0;

  function shouldAuditSuccess(generation: number, timestamp: number): boolean {
    if (generation !== lastSuccessAuditGeneration || timestamp - lastSuccessAuditAt >= CREDENTIAL_AUDIT_INTERVAL_MS) {
      lastSuccessAuditGeneration = generation;
      lastSuccessAuditAt = timestamp;
      return true;
    }

    return false;
  }

  function enqueue(saveCreds: () => Promise<void>, generation: number): void {
    queue = queue
      .catch(() => undefined)
      .then(async () => {
        try {
          await saveCreds();
          onSuccess();

          const timestamp = now();
          if (shouldAuditSuccess(generation, timestamp)) {
            audit({
              level: "info",
              category: "security",
              code: "baileys.credentials.persisted",
              title: "WhatsApp credentials persisted",
              description: "Updated Baileys credentials were persisted successfully.",
              metadata: { socketGeneration: generation },
            });
          }
        } catch (error) {
          onFailure();
          logFailure(error);
          audit({
            level: "error",
            category: "security",
            code: "baileys.credentials.persist_failed",
            title: "WhatsApp credential persistence failed",
            description: "Baileys credential state could not be persisted.",
            metadata: {
              socketGeneration: generation,
              errorName: error instanceof Error ? error.name : "UNKNOWN",
            },
          });
        }
      });
  }

  async function flush(): Promise<void> {
    await queue.catch(() => undefined);
  }

  return { enqueue, flush };
}
