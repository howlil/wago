import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AccountHealthSnapshot,
  type AppInfoResponse,
  type BootstrapAppResponse,
  getAppInfo,
  getCurrentQr,
  getHealth,
  getQrImageSvg,
  getWhatsAppStatus,
  type WhatsAppBinding,
  type WhatsAppStatus,
} from "../../api.js";
import type { BackendHealthState } from "../../shared/types/status.js";

const unboundBinding: WhatsAppBinding = {
  state: "unbound",
  jid: null,
  phone: null,
  boundAt: null,
};

const visibleRefreshIntervalsMs: Record<WhatsAppStatus, number> = {
  connecting: 5000,
  qr: 5000,
  connected: 30000,
  disconnected: 15000,
};

const hiddenRefreshIntervalMs = 60000;

type SuccessfulBootstrap = Extract<BootstrapAppResponse, { success: true }>;

export function useDashboardSnapshot() {
  const [health, setHealth] = useState<BackendHealthState>("checking");
  const [appId, setAppId] = useState("wa-gateway");
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [apiKeySource, setApiKeySource] = useState<AppInfoResponse["apiKeySource"]>("unset");
  const [credentialSetupRequired, setCredentialSetupRequired] = useState(false);
  const [setupTokenRequired, setSetupTokenRequired] = useState(false);
  const [webBootstrapEnabled, setWebBootstrapEnabled] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [status, setStatus] = useState<WhatsAppStatus>("disconnected");
  const [binding, setBinding] = useState<WhatsAppBinding>(unboundBinding);
  const [accountHealth, setAccountHealth] = useState<AccountHealthSnapshot | undefined>();
  const [hasQr, setHasQr] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isRefreshInFlight = useRef(false);
  const pollTimer = useRef<number | null>(null);
  const statusRef = useRef<WhatsAppStatus>("disconnected");

  const updateStatus = useCallback((nextStatus: WhatsAppStatus) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }, []);

  const loadAppInfo = useCallback(async () => {
    const info = await getAppInfo();

    setAppId(info.appId);
    setApiKeyConfigured(info.apiKeyConfigured);
    setApiKeySource(info.apiKeySource);
    setCredentialSetupRequired(info.credentialSetupRequired);
    setSetupTokenRequired(Boolean(info.setupTokenRequired));
    setWebBootstrapEnabled(info.webBootstrapEnabled ?? true);
    setIsAuthenticated(info.authenticated);

    return info;
  }, []);

  const clearWhatsAppView = useCallback(() => {
    updateStatus("disconnected");
    setBinding(unboundBinding);
    setAccountHealth(undefined);
    setHasQr(false);
    setQrImage(null);
  }, [updateStatus]);

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
        try {
          const healthResult = await getHealth();
          const backendHealthy = healthResult.status === "ok";
          setHealth(backendHealthy ? "ok" : "error");

          if (!backendHealthy) {
            clearWhatsAppView();
            return;
          }
        } catch {
          setHealth("error");
          clearWhatsAppView();
          return;
        }

        let info: Awaited<ReturnType<typeof loadAppInfo>>;

        try {
          info = await loadAppInfo();
        } catch {
          setHealth("error");
          clearWhatsAppView();
          return;
        }

        if (!info.authenticated) {
          clearWhatsAppView();
          return;
        }

        try {
          const [statusResult, qrResult] = await Promise.all([getWhatsAppStatus(), getCurrentQr()]);
          updateStatus(statusResult.status);
          setBinding(statusResult.binding);
          setAccountHealth(statusResult.accountHealth);
          setHasQr(Boolean(qrResult.qr));
          setQrImage(qrResult.qr ? await getQrImageSvg() : null);
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
    [clearWhatsAppView, loadAppInfo, updateStatus],
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
        : visibleRefreshIntervalsMs[statusRef.current];
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
  }, [refresh]);

  const applyBootstrap = useCallback((result: SuccessfulBootstrap) => {
    setAppId(result.appId);
    setApiKeyConfigured(true);
    setApiKeySource("generated");
    setCredentialSetupRequired(false);
    setSetupTokenRequired(false);
    setIsAuthenticated(true);
  }, []);

  const resetBinding = useCallback(
    (nextStatus: WhatsAppStatus) => {
      setBinding(unboundBinding);
      setAccountHealth(undefined);
      setHasQr(false);
      setQrImage(null);
      updateStatus(nextStatus);
    },
    [updateStatus],
  );

  return {
    health,
    appId,
    apiKeyConfigured,
    apiKeySource,
    credentialSetupRequired,
    setupTokenRequired,
    webBootstrapEnabled,
    isAuthenticated,
    status,
    binding,
    accountHealth,
    hasQr,
    qrImage,
    isRefreshing,
    refresh,
    loadAppInfo,
    updateStatus,
    applyBootstrap,
    resetBinding,
  };
}
