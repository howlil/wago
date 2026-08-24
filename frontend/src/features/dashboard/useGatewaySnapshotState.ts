import { useCallback, useRef, useState } from "react";
import type { BackendHealthState } from "../../shared/types/status.js";
import {
  type AppInfoResponse,
  type BootstrapAppResponse,
  type GatewayReadinessSnapshot,
  getAppInfo,
  getHealth,
  getReadiness,
} from "../gateway/api.js";

type SuccessfulBootstrap = Extract<BootstrapAppResponse, { success: true }>;

export function useGatewaySnapshotState() {
  const [health, setHealth] = useState<BackendHealthState>("checking");
  const [readiness, setReadiness] = useState<GatewayReadinessSnapshot | null>(null);
  const [appId, setAppId] = useState("wa-gateway");
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [apiKeySource, setApiKeySource] = useState<AppInfoResponse["apiKeySource"]>("unset");
  const [credentialSetupRequired, setCredentialSetupRequired] = useState(false);
  const [setupCodeRequired, setSetupCodeRequired] = useState(false);
  const [webBootstrapEnabled, setWebBootstrapEnabled] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const isReadinessRefreshInFlight = useRef(false);
  const readinessGeneration = useRef(0);

  const loadAppInfo = useCallback(async () => {
    const info = await getAppInfo();

    setAppId(info.appId);
    setApiKeyConfigured(info.apiKeyConfigured);
    setApiKeySource(info.apiKeySource);
    setCredentialSetupRequired(info.credentialSetupRequired);
    setSetupCodeRequired(Boolean(info.setupCodeRequired ?? info.setupTokenRequired));
    setWebBootstrapEnabled(info.webBootstrapEnabled ?? true);
    setIsAuthenticated(info.authenticated);

    return info;
  }, []);

  const invalidateReadiness = useCallback(() => {
    readinessGeneration.current += 1;
    setReadiness(null);
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      const healthResult = await getHealth();
      const backendHealthy = healthResult.status === "ok";
      setHealth(backendHealthy ? "ok" : "error");

      if (!backendHealthy) {
        invalidateReadiness();
      }

      return backendHealthy;
    } catch {
      setHealth("error");
      invalidateReadiness();
      return false;
    }
  }, [invalidateReadiness]);

  const markHealthError = useCallback(() => {
    setHealth("error");
  }, []);

  const refreshReadiness = useCallback(async () => {
    if (isReadinessRefreshInFlight.current) {
      return;
    }

    const generation = readinessGeneration.current;
    isReadinessRefreshInFlight.current = true;
    try {
      const nextReadiness = await getReadiness();
      if (generation === readinessGeneration.current) {
        setReadiness(nextReadiness);
      }
    } catch {
      if (generation === readinessGeneration.current) {
        setReadiness(null);
      }
    } finally {
      isReadinessRefreshInFlight.current = false;
    }
  }, []);

  const applyBootstrap = useCallback((result: SuccessfulBootstrap) => {
    setAppId(result.appId);
    setApiKeyConfigured(true);
    setApiKeySource("generated");
    setCredentialSetupRequired(false);
    setSetupCodeRequired(false);
    setIsAuthenticated(true);
  }, []);

  return {
    health,
    readiness,
    appId,
    apiKeyConfigured,
    apiKeySource,
    credentialSetupRequired,
    setupCodeRequired,
    webBootstrapEnabled,
    isAuthenticated,
    refreshHealth,
    markHealthError,
    loadAppInfo,
    invalidateReadiness,
    refreshReadiness,
    applyBootstrap,
  };
}
