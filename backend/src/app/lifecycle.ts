export type ApplicationLifecycleDeps = {
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
        deps.checkpointDatabase();
        deps.closeDatabase();
      })();
      return stopPromise;
    },
  };
}
