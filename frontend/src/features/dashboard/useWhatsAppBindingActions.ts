import { type Dispatch, type SetStateAction, useState } from "react";
import type { Notice } from "../../shared/ui/feedback.js";
import { bootstrapApp, createApiKeyCandidate } from "../gateway/api.js";
import { pairWhatsApp, rebindWhatsApp } from "../whatsapp/api.js";
import type { useDashboardSnapshot } from "./useDashboardSnapshot.js";

type DashboardSnapshot = ReturnType<typeof useDashboardSnapshot>;

type WhatsAppBindingActionsOptions = {
  snapshot: DashboardSnapshot;
  setNotice: Dispatch<SetStateAction<Notice>>;
  apiKeyInput: string;
  setApiKeyInput: Dispatch<SetStateAction<string>>;
  setupTokenInput: string;
  setSetupTokenInput: Dispatch<SetStateAction<string>>;
};

export function useWhatsAppBindingActions({
  snapshot,
  setNotice,
  apiKeyInput,
  setApiKeyInput,
  setupTokenInput,
  setSetupTokenInput,
}: WhatsAppBindingActionsOptions) {
  const [isRebinding, setIsRebinding] = useState(false);
  const [isPairing, setIsPairing] = useState(false);
  const [isRebindDialogOpen, setIsRebindDialogOpen] = useState(false);

  const pairingInProgress =
    snapshot.isAuthenticated &&
    snapshot.binding.state === "unbound" &&
    (snapshot.status === "connecting" || snapshot.status === "qr");
  const canStartPairing =
    snapshot.credentialSetupRequired || (snapshot.isAuthenticated && snapshot.binding.state === "unbound");

  async function handlePair() {
    if (snapshot.health !== "ok") {
      setNotice({ type: "error", message: "Backend is unavailable. Start the backend, then try pairing again." });
      return;
    }
    if (snapshot.credentialSetupRequired && !snapshot.webBootstrapEnabled) {
      setNotice({
        type: "error",
        message: "First-run web setup is disabled. Configure SETUP_TOKEN on the Wago deployment first.",
      });
      return;
    }
    if (snapshot.setupTokenRequired && !setupTokenInput.trim()) {
      setNotice({ type: "error", message: "Enter the deployment setup token before first pairing." });
      return;
    }
    setIsPairing(true);
    setNotice(null);
    try {
      if (!snapshot.isAuthenticated) {
        if (!snapshot.credentialSetupRequired) {
          setNotice({ type: "error", message: "Sign in with the existing API key before managing WhatsApp binding." });
          return;
        }
        const candidate = createApiKeyCandidate();
        try {
          const result = await bootstrapApp(
            candidate,
            snapshot.setupTokenRequired ? setupTokenInput.trim() : undefined,
          );
          if (!result.success) {
            setNotice({ type: "error", message: result.message });
            return;
          }
          setSetupTokenInput("");
          setApiKeyInput(result.apiKey);
          snapshot.applyBootstrap(result);
        } catch (error) {
          const apiError = error as { message?: string; error?: string };
          if (apiError.error === "APP_ALREADY_INITIALIZED") {
            const info = await snapshot.loadAppInfo().catch(() => null);
            if (!info?.authenticated) {
              setNotice({
                type: "error",
                message: "Gateway credentials already exist. Sign in with the existing API key to continue.",
              });
              return;
            }
          } else {
            setNotice({
              type: "error",
              message: apiError.message ?? "Gateway setup was interrupted. Retry Pair WhatsApp to recover safely.",
            });
            return;
          }
        }
      }
      const result = await pairWhatsApp();
      if (!result.success) {
        setNotice({ type: "error", message: result.message });
        return;
      }
      snapshot.updateStatus(result.status);
      setNotice({
        type: "success",
        message:
          apiKeyInput || snapshot.credentialSetupRequired
            ? "Pairing started. Save the API key shown in Gateway credentials; Wago will not store it in this browser."
            : result.status === "qr"
              ? "QR is ready. Scan it from WhatsApp Linked devices."
              : result.message,
      });
      await snapshot.refresh({ showLoading: true });
    } catch (error) {
      const apiError = error as { message?: string; error?: string };
      setNotice({ type: "error", message: apiError.message ?? apiError.error ?? "Failed to start pairing" });
    } finally {
      setIsPairing(false);
    }
  }

  async function handleRebind() {
    setIsRebinding(true);
    setNotice(null);
    try {
      const result = await rebindWhatsApp();
      if (!result.success) {
        setNotice({ type: "error", message: result.message });
        return;
      }
      snapshot.resetBinding(result.status);
      setNotice({ type: "success", message: "Previous account unbound. Scan the new QR when it appears." });
      setIsRebindDialogOpen(false);
      await snapshot.refresh({ showLoading: true });
    } catch (error) {
      const apiError = error as { message?: string; error?: string };
      setNotice({
        type: "error",
        message: apiError.message ?? apiError.error ?? "Failed to start a new WhatsApp pairing session",
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
        : !snapshot.credentialSetupRequired && !snapshot.isAuthenticated
          ? "Sign in with the existing API key to manage this gateway."
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
    pairingInProgress,
    canStartPairing,
    connectionDescription,
    pairButtonLabel,
    handlePair,
    handleRebind,
    openRebindDialog: () => setIsRebindDialogOpen(true),
    closeRebindDialog: () => setIsRebindDialogOpen(false),
  };
}
