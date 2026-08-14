import { type InstanceLeaseResult, WagoInstanceAlreadyActiveError } from "../infrastructure/instance-lease.js";

export type ApplicationLifecycleDeps = {
  acquireInstanceLease: () => InstanceLeaseResult;
  startInstanceLeaseHeartbeat: () => void;
  stopInstanceLeaseHeartbeat: () => void;
  releaseInstanceLease: () => boolean;
  startWebhookDeliveryWorker: () => void;
  stopWebhookDeliveryWorker: () => Promise<void>;
  resumeWhatsAppSession: () => Promise<void>;
  shutdownWhatsApp: () => Promise<void>;
  flushOutboundPolicyPersistence: () => Promise<void>;
  checkpointDatabase: () => void;
  closeDatabase: () => void;
};

export function createApplicationLifecycle(deps: ApplicationLifecycleDeps): {
  start(): Promise<void>;
  stop(signal: NodeJS.Signals | "test"): Promise<void>;
} {
  let startPromise: Promise<void> | undefined;
  let stopPromise: Promise<void> | undefined;

  return {
    start(): Promise<void> {
      startPromise ??= (async () => {
        const lease = deps.acquireInstanceLease();
        if (!lease.acquired) throw new WagoInstanceAlreadyActiveError();

        deps.startInstanceLeaseHeartbeat();
        deps.startWebhookDeliveryWorker();
        await deps.resumeWhatsAppSession();
      })();
      return startPromise;
    },

    stop(_signal: NodeJS.Signals | "test"): Promise<void> {
      stopPromise ??= (async () => {
        await deps.stopWebhookDeliveryWorker();
        await deps.shutdownWhatsApp();
        await deps.flushOutboundPolicyPersistence();
        deps.stopInstanceLeaseHeartbeat();
        deps.releaseInstanceLease();
        deps.checkpointDatabase();
        deps.closeDatabase();
      })();
      return stopPromise;
    },
  };
}
