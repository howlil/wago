import { useState } from "react";
import {
  bootstrapApp,
  createApiKeyCandidate,
  createBrowserSession,
  logoutAllBrowserSessions,
  logoutBrowserSession,
  pairWhatsApp,
  rebindWhatsApp,
  rotateApiKey,
} from "../../api.js";
import { useClipboard } from "../../shared/hooks/useClipboard.js";
import type { Notice } from "../../shared/ui/feedback.js";
import type { CopiedField } from "../gateway/types.js";
import { useMessageComposer } from "../messages/useMessageComposer.js";
import { useDashboardSnapshot } from "./useDashboardSnapshot.js";

export function useDashboardController() {
  const snapshot = useDashboardSnapshot();
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [setupCodeInput, setSetupCodeInput] = useState("");
  const [setupCodeError, setSetupCodeError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [isRebinding, setIsRebinding] = useState(false);
  const [isPairing, setIsPairing] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSigningOutAll, setIsSigningOutAll] = useState(false);
  const [isRotatingApiKey, setIsRotatingApiKey] = useState(false);
  const [isRebindDialogOpen, setIsRebindDialogOpen] = useState(false);
  const [isApiKeyRotationDialogOpen, setIsApiKeyRotationDialogOpen] = useState(false);
  const [isSetupCodeDialogOpen, setIsSetupCodeDialogOpen] = useState(false);
  const { copiedField, copy } = useClipboard<Exclude<CopiedField, null>>({
    onError: (message) => setNotice({ type: "error", message }),
  });
  const messaging = useMessageComposer({
    isAuthenticated: snapshot.isAuthenticated,
    status: snapshot.status,
    onNotice: setNotice,
    onAfterMutation: () => snapshot.refresh({ showLoading: false }),
  });
  const pairingInProgress =
    snapshot.isAuthenticated &&
    snapshot.binding.state === "unbound" &&
    (snapshot.status === "connecting" || snapshot.status === "qr");
  const canStartPairing =
    snapshot.credentialSetupRequired || (snapshot.isAuthenticated && snapshot.binding.state === "unbound");

  async function startPairing(setupCode?: string) {
    setIsPairing(true);
    setNotice(null);
    setSetupCodeError(null);
    let generatedCredential = false;

    try {
      if (!snapshot.isAuthenticated) {
        if (!snapshot.credentialSetupRequired) {
          setNotice({ type: "error", message: "Sign in with the existing API key before managing WhatsApp binding." });
          return;
        }

        const candidate = createApiKeyCandidate();
        try {
          const result = await bootstrapApp(candidate, setupCode);
          if (!result.success) {
            setNotice({ type: "error", message: result.message });
            return;
          }

          generatedCredential = true;
          setSetupCodeInput("");
          setSetupCodeError(null);
          setIsSetupCodeDialogOpen(false);
          setApiKeyInput(result.apiKey);
          snapshot.applyBootstrap(result);
        } catch (error) {
          const apiError = error as { message?: string; error?: string };
          if (apiError.error === "APP_ALREADY_INITIALIZED") {
            const info = await snapshot.loadAppInfo().catch(() => null);
            if (!info?.authenticated) {
              setIsSetupCodeDialogOpen(false);
              setNotice({
                type: "error",
                message: "Gateway credentials already exist. Sign in with the existing API key to continue.",
              });
              return;
            }
          } else if (apiError.error === "INVALID_SETUP_CODE" || apiError.error === "SETUP_CODE_REQUIRED") {
            setSetupCodeError(apiError.message ?? "The setup code is invalid.");
            setIsSetupCodeDialogOpen(true);
            return;
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
        message: generatedCredential
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

  async function handlePair() {
    if (snapshot.health !== "ok") {
      setNotice({ type: "error", message: "Backend is unavailable. Start the backend, then try pairing again." });
      return;
    }

    if (snapshot.credentialSetupRequired) {
      if (!snapshot.webBootstrapEnabled) {
        setNotice({
          type: "error",
          message: "First-run setup is unavailable. Restart Wago and check deployment logs for a fresh setup code.",
        });
        return;
      }

      if (snapshot.setupCodeRequired) {
        setSetupCodeError(null);
        setIsSetupCodeDialogOpen(true);
        return;
      }
    }

    await startPairing();
  }

  async function handleConfirmSetupCode() {
    const setupCode = setupCodeInput.trim();
    if (!setupCode) {
      setSetupCodeError("Enter the one-time setup code from the Wago deployment logs.");
      return;
    }

    await startPairing(setupCode);
  }

  function closeSetupCodeDialog() {
    if (isPairing) return;
    setIsSetupCodeDialogOpen(false);
    setSetupCodeInput("");
    setSetupCodeError(null);
  }

  async function handleSignIn() {
    const candidate = apiKeyInput.trim();
    if (!candidate) {
      setNotice({ type: "error", message: "Enter the API key first." });
      return;
    }
    setIsSigningIn(true);
    setNotice(null);
    try {
      const result = await createBrowserSession(candidate);
      if (!result.success) {
        setNotice({ type: "error", message: result.message });
        return;
      }
      setApiKeyInput("");
      setShowApiKey(false);
      const info = await snapshot.loadAppInfo();
      if (!info.authenticated) {
        setNotice({ type: "error", message: "The backend did not establish a browser session." });
        return;
      }
      setNotice({ type: "success", message: "Signed in. The API key was not stored in this browser." });
      await snapshot.refresh({ showLoading: true });
    } catch (error) {
      const apiError = error as { message?: string; error?: string };
      setNotice({ type: "error", message: apiError.message ?? apiError.error ?? "Failed to sign in" });
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    setNotice(null);
    try {
      await logoutBrowserSession();
      setApiKeyInput("");
      setShowApiKey(false);
      setIsApiKeyRotationDialogOpen(false);
      await snapshot.refresh({ showLoading: true });
      setNotice({ type: "success", message: "Signed out from this browser. External API clients are unaffected." });
    } catch (error) {
      const apiError = error as { message?: string; error?: string };
      setNotice({ type: "error", message: apiError.message ?? apiError.error ?? "Failed to sign out" });
    } finally {
      setIsSigningOut(false);
    }
  }

  async function handleSignOutAll() {
    setIsSigningOutAll(true);
    setNotice(null);
    try {
      await logoutAllBrowserSessions();
      setApiKeyInput("");
      setShowApiKey(false);
      setIsApiKeyRotationDialogOpen(false);
      await snapshot.refresh({ showLoading: true });
      setNotice({
        type: "success",
        message: "All dashboard sessions were revoked. Machine API clients and WhatsApp auth are unchanged.",
      });
    } catch (error) {
      const apiError = error as { message?: string; error?: string };
      setNotice({ type: "error", message: apiError.message ?? apiError.error ?? "Failed to sign out all sessions" });
    } finally {
      setIsSigningOutAll(false);
    }
  }

  async function handleRotateApiKey() {
    if (!snapshot.isAuthenticated || snapshot.apiKeySource !== "generated") {
      setNotice({ type: "error", message: "Only generated API keys can be rotated from the dashboard." });
      return;
    }
    setIsRotatingApiKey(true);
    setNotice(null);
    try {
      const result = await rotateApiKey();
      if (!result.success) {
        setNotice({ type: "error", message: result.message });
        return;
      }
      setApiKeyInput(result.apiKey);
      setShowApiKey(true);
      setIsApiKeyRotationDialogOpen(false);
      setNotice({
        type: "success",
        message: `API key rotated and ${result.revokedBrowserSessions} other dashboard session(s) revoked. Save the new key now.`,
      });
    } catch (error) {
      const apiError = error as { message?: string; error?: string };
      setNotice({ type: "error", message: apiError.message ?? apiError.error ?? "Failed to rotate API key" });
    } finally {
      setIsRotatingApiKey(false);
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

  const credentialHint = snapshot.credentialSetupRequired
    ? "Generated once after first pairing. Save it for API clients and browser recovery."
    : snapshot.isAuthenticated && apiKeyInput
      ? "Shown once. Save this API key now; Wago does not persist it in browser storage."
      : snapshot.isAuthenticated
        ? "Dashboard access uses a separate secure browser session. API keys remain for external REST clients."
        : "Enter the existing API key once to create a browser session. It will not be stored in this browser.";
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
    health: snapshot.health,
    appId: snapshot.appId,
    apiKeyConfigured: snapshot.apiKeyConfigured,
    apiKeySource: snapshot.apiKeySource,
    credentialSetupRequired: snapshot.credentialSetupRequired,
    setupCodeRequired: snapshot.setupCodeRequired,
    webBootstrapEnabled: snapshot.webBootstrapEnabled,
    isAuthenticated: snapshot.isAuthenticated,
    status: snapshot.status,
    binding: snapshot.binding,
    accountHealth: snapshot.accountHealth,
    hasQr: snapshot.hasQr,
    qrImage: snapshot.qrImage,
    isRefreshing: snapshot.isRefreshing,
    refresh: snapshot.refresh,
    apiKeyInput,
    setupCodeInput,
    setupCodeError,
    showApiKey,
    copiedField,
    notice,
    isRebinding,
    isPairing,
    isSigningIn,
    isSigningOut,
    isSigningOutAll,
    isRotatingApiKey,
    isRebindDialogOpen,
    isApiKeyRotationDialogOpen,
    isSetupCodeDialogOpen,
    phone: messaging.phone,
    message: messaging.message,
    recipientApprovalPhone: messaging.recipientApprovalPhone,
    recipientRefreshKey: messaging.recipientRefreshKey,
    lastMessage: messaging.lastMessage,
    isSending: messaging.isSending,
    canSend: messaging.canSend,
    approvalRequired: messaging.approvalRequired,
    canStartPairing,
    pairingInProgress,
    credentialHint,
    connectionDescription,
    pairButtonLabel,
    setApiKeyInput,
    setSetupCodeInput: (value: string) => {
      setSetupCodeInput(value);
      if (setupCodeError) setSetupCodeError(null);
    },
    toggleApiKey: () => setShowApiKey((value) => !value),
    copyAppId: () => void copy(snapshot.appId, "appId"),
    copyApiKey: () => void copy(apiKeyInput, "apiKey"),
    handlePair,
    handleConfirmSetupCode,
    closeSetupCodeDialog,
    handleSignIn,
    handleSignOut,
    handleSignOutAll,
    handleRotateApiKey,
    handleRebind,
    openRebindDialog: () => setIsRebindDialogOpen(true),
    closeRebindDialog: () => setIsRebindDialogOpen(false),
    openApiKeyRotationDialog: () => setIsApiKeyRotationDialogOpen(true),
    closeApiKeyRotationDialog: () => setIsApiKeyRotationDialogOpen(false),
    handlePhoneChange: messaging.handlePhoneChange,
    setMessage: messaging.setMessage,
    handleSubmit: messaging.handleSubmit,
    allowAndSend: messaging.allowAndSend,
    handleRecipientAllowed: messaging.handleRecipientAllowed,
  };
}
