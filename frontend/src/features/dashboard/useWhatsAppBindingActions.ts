import { type Dispatch, type SetStateAction, useState } from "react";
import { ApiError } from "../../shared/api/client.js";
import type { Notice } from "../../shared/ui/feedback.js";
import { bootstrapApp, createApiKeyCandidate } from "../gateway/api.js";
import { pairWhatsApp, rebindWhatsApp } from "../whatsapp/api.js";
import type { useDashboardSnapshot } from "./useDashboardSnapshot.js";

type DashboardSnapshot = ReturnType<typeof useDashboardSnapshot>;

type WhatsAppBindingActionsOptions = {
  snapshot: DashboardSnapshot;
  setNotice: Dispatch<SetStateAction<Notice>>;
  setApiKeyInput: Dispatch<SetStateAction<string>>;
};

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError || error instanceof Error ? error.message : fallback;
}

export function useWhatsAppBindingActions({
  snapshot,
  setNotice,
  setApiKeyInput,
}: WhatsAppBindingActionsOptions) {
  const [isRebinding, setIsRebinding] = useState(false);
  const [isPairing, setIsPairing] = useState(false);
  const [isRebindDialogOpen, setIsRebindDialogOpen] = useState(false);
  const [isFirstRunSetupDialogOpen, setIsFirstRunSetupDialogOpen] = useState(false);
  const [setupCodeInput, setSetupCodeInput] = useState("");
  const [setupCodeError, setSetupCodeError] = useState<string | null>(null);

  const pairingInProgress =
    snapshot.isAuthenticated &&
    snapshot.binding.state === "unbound" &&
    (snapshot.status === "connecting" || snapshot.status === "qr");
  const canStartPairing =
    (snapshot.isAuthenticated && (snapshot.credentialSetupRequired || snapshot.binding.state === "unbound")) ||
    (snapshot.credentialSetupRequired && snapshot.setupCodeRequired);

  async function startPairing(legacySetupCode?: string): Promise<boolean> {
    setIsPairing(true);
    setNotice(null);
    let generatedApiKey = false;

    try {
      if (!snapshot.isAuthenticated && !legacySetupCode) {
        setNotice({
          type: "error",
          message:
            snapshot.dashboardAuthMode === "unconfigured"
              ? "Configure WAGO_ADMIN_PASSWORD, restart Wago, then sign in before pairing WhatsApp."
              : "Sign in to the dashboard before managing WhatsApp binding.",
        });
        return false;
      }

      if (snapshot.credentialSetupRequired) {
        const candidate = createApiKeyCandidate();
        try {
          const result = await bootstrapApp(candidate, legacySetupCode);
          setApiKeyInput(result.apiKey);
          snapshot.applyBootstrap(result);
          generatedApiKey = true;
          setSetupCodeInput("");
          setSetupCodeError(null);
          setIsFirstRunSetupDialogOpen(false);
        } catch (error) {
          if (error instanceof ApiError && error.code === "APP_ALREADY_INITIALIZED") {
            const info = await snapshot.loadAppInfo().catch(() => null);
            if (!info?.authenticated) {
              setNotice({
                type: "error",
                message: "Gateway API credentials already exist. Sign in to the dashboard to continue.",
              });
              return false;
            }
            setSetupCodeInput("");
            setSetupCodeError(null);
            setIsFirstRunSetupDialogOpen(false);
          } else {
            const message = apiErrorMessage(
              error,
              "Gateway setup was interrupted. Retry Pair WhatsApp to recover safely.",
            );
            if (legacySetupCode) setSetupCodeError(message);
            else setNotice({ type: "error", message });
            return false;
          }
        }
      }

      const result = await pairWhatsApp();
      snapshot.updateStatus(result.status);
      setNotice({
        type: "success",
        message: generatedApiKey
          ? "Pairing started. Save the machine API key shown in Gateway credentials for external API clients."
          : result.status === "qr"
            ? "QR is ready. Scan it from WhatsApp Linked devices."
            : result.message,
      });
      await snapshot.refresh({ showLoading: true });
      return true;
    } catch (error) {
      setNotice({ type: "error", message: apiErrorMessage(error, "Failed to start pairing") });
      return false;
    } finally {
      setIsPairing(false);
    }
  }

  async function handlePair() {
    if (snapshot.health !== "ok") {
      setNotice({ type: "error", message: "Backend is unavailable. Start the backend, then try pairing again." });
      return;
    }

    if (!snapshot.isAuthenticated) {
      if (snapshot.credentialSetupRequired && snapshot.setupCodeRequired) {
        setSetupCodeInput("");
        setSetupCodeError(null);
        setIsFirstRunSetupDialogOpen(true);
        return;
      }

      setNotice({
        type: "error",
        message:
          snapshot.dashboardAuthMode === "unconfigured"
            ? "Configure WAGO_ADMIN_PASSWORD in the deployment, restart Wago, then sign in before pairing."
            : "Sign in to the dashboard before pairing WhatsApp.",
      });
      return;
    }

    await startPairing();
  }

  async function handleConfirmFirstRunSetup() {
    const setupCode = setupCodeInput.trim();
    if (!setupCode) {
      setSetupCodeError("Enter the legacy SETUP_TOKEN configured in the deployment environment.");
      return;
    }

    setSetupCodeError(null);
    await startPairing(setupCode);
  }

  async function handleRebind() {
    setIsRebinding(true);
    setNotice(null);
    try {
      const result = await rebindWhatsApp();
      snapshot.resetBinding(result.status);
      setNotice({ type: "success", message: "Previous account unbound. Scan the new QR when it appears." });
      setIsRebindDialogOpen(false);
      await snapshot.refresh({ showLoading: true });
    } catch (error) {
      setNotice({
        type: "error",
        message: apiErrorMessage(error, "Failed to start a new WhatsApp pairing session"),
      });
    } finally {
      setIsRebinding(false);
    }
  }

  const connectionDescription =
    snapshot.health === "error"
      ? "Backend is unavailable. In local development, make sure the backend is running on port 3000."
      : snapshot.health === "checking"
        ? "Checking backend before pairing."
        : !snapshot.isAuthenticated
          ? snapshot.setupCodeRequired
            ? "Legacy SETUP_TOKEN bootstrap is available, but new deployments should use WAGO_ADMIN_PASSWORD."
            : snapshot.dashboardAuthMode === "unconfigured"
              ? "Configure WAGO_ADMIN_PASSWORD in the deployment, restart Wago, then sign in."
              : snapshot.dashboardAuthMode === "password"
                ? "Sign in with the admin password to manage this gateway."
                : "Sign in through the legacy API-key recovery path, then configure WAGO_ADMIN_PASSWORD."
          : snapshot.binding.state === "bound"
            ? snapshot.status === "connected"
              ? `Bound to ${snapshot.binding.phone} and connected.`
              : snapshot.status === "connecting"
                ? `Reconnecting the bound account ${snapshot.binding.phone}.`
                : `Bound to ${snapshot.binding.phone}, but the session is currently disconnected.`
            : snapshot.status === "qr"
              ? "Scan the QR below from WhatsApp → Linked devices."
              : snapshot.status === "connecting"
                ? "Preparing a new WhatsApp pairing session."
                : "No WhatsApp account is bound to this gateway yet.";
  const pairButtonLabel = isPairing
    ? "Preparing QR"
    : pairingInProgress
      ? snapshot.status === "qr"
        ? "QR ready"
        : "Preparing QR"
      : "Pair WhatsApp";

  return {
    isRebinding,
    isPairing,
    isRebindDialogOpen,
    isFirstRunSetupDialogOpen,
    setupCodeInput,
    setupCodeError,
    pairingInProgress,
    canStartPairing,
    connectionDescription,
    pairButtonLabel,
    setSetupCodeInput,
    handlePair,
    handleConfirmFirstRunSetup,
    handleRebind,
    openRebindDialog: () => setIsRebindDialogOpen(true),
    closeRebindDialog: () => setIsRebindDialogOpen(false),
    closeFirstRunSetupDialog: () => {
      setSetupCodeInput("");
      setSetupCodeError(null);
      setIsFirstRunSetupDialogOpen(false);
    },
  };
}
