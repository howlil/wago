import { useCallback, useEffect, useRef, useState } from "react";
import { useGatewaySnapshotState } from "../gateway/useGatewaySnapshotState.js";
import { useWhatsAppSnapshotState } from "../whatsapp/useWhatsAppSnapshotState.js";

type DashboardStatus = ReturnType<typeof useWhatsAppSnapshotState>["status"];

const visibleRefreshIntervalsMs: Record<DashboardStatus, number> = {
  connecting: 5000,
  qr: 5000,
  connected: 30000,
  disconnected: 15000,
};

const hiddenRefreshIntervalMs = 60000;

export function useDashboardSnapshot() {
  const gateway = useGatewaySnapshotState();
  const whatsapp = useWhatsAppSnapshotState();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isRefreshInFlight = useRef(false);
  const pollTimer = useRef<number | null>(null);
  const { refreshHealth, markHealthError, refreshReadiness, loadAppInfo } = gateway;
  const { clearWhatsAppView, refreshWhatsAppView, getCurrentStatus } = whatsapp;

  const refresh = useCallback(
    async (options: { showLoading?: boolean } = {}) => {
      const showLoading = options.showLoading ?? true;

      if (isRefreshInFlight.current) {
        return;
      }

      isRefreshInFlight.current = true;

      if (showLoading) {
        setIsRefreshing(true);
      }

      try {
        const backendHealthy = await refreshHealth();

        if (!backendHealthy) {
          clearWhatsAppView();
          return;
        }

        void refreshReadiness();

        let info: Awaited<ReturnType<typeof loadAppInfo>>;

        try {
          info = await loadAppInfo();
        } catch {
          markHealthError();
          clearWhatsAppView();
          return;
        }

        if (!info.authenticated) {
          clearWhatsAppView();
          return;
        }

        try {
          await refreshWhatsAppView();
        } catch {
          clearWhatsAppView();
        }
      } finally {
        isRefreshInFlight.current = false;

        if (showLoading) {
          setIsRefreshing(false);
        }
      }
    },
    [clearWhatsAppView, loadAppInfo, markHealthError, refreshHealth, refreshReadiness, refreshWhatsAppView],
  );

  useEffect(() => {
    let disposed = false;

    function clearPollTimer() {
      if (pollTimer.current !== null) {
        window.clearTimeout(pollTimer.current);
        pollTimer.current = null;
      }
    }

    function getNextRefreshDelay() {
      return document.visibilityState === "hidden"
        ? hiddenRefreshIntervalMs
        : visibleRefreshIntervalsMs[getCurrentStatus()];
    }

    function scheduleNextRefresh(delay = getNextRefreshDelay()) {
      clearPollTimer();
      pollTimer.current = window.setTimeout(async () => {
        if (disposed) {
          return;
        }

        if (document.visibilityState === "visible") {
          await refresh({ showLoading: false });
        }

        if (!disposed) {
          scheduleNextRefresh();
        }
      }, delay);
    }

    function handleVisibilityChange() {
      if (disposed) {
        return;
      }

      clearPollTimer();

      if (document.visibilityState === "visible") {
        void refresh({ showLoading: false }).finally(() => {
          if (!disposed) {
            scheduleNextRefresh();
          }
        });
        return;
      }

      scheduleNextRefresh(hiddenRefreshIntervalMs);
    }

    void refresh({ showLoading: true }).finally(() => {
      if (!disposed) {
        scheduleNextRefresh();
      }
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearPollTimer();
    };
  }, [getCurrentStatus, refresh]);

  return {
    health: gateway.health,
    readiness: gateway.readiness,
    appId: gateway.appId,
    apiKeyConfigured: gateway.apiKeyConfigured,
    apiKeySource: gateway.apiKeySource,
    credentialSetupRequired: gateway.credentialSetupRequired,
    setupCodeRequired: gateway.setupCodeRequired,
    webBootstrapEnabled: gateway.webBootstrapEnabled,
    isAuthenticated: gateway.isAuthenticated,
    status: whatsapp.status,
    binding: whatsapp.binding,
    accountHealth: whatsapp.accountHealth,
    hasQr: whatsapp.hasQr,
    qrImage: whatsapp.qrImage,
    isRefreshing,
    refresh,
    loadAppInfo: gateway.loadAppInfo,
    updateStatus: whatsapp.updateStatus,
    applyBootstrap: gateway.applyBootstrap,
    resetBinding: whatsapp.resetBinding,
  };
}
