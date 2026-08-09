import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type AccountHealthSnapshot,
  type AppInfoResponse,
  allowRecipient,
  bootstrapApp,
  createApiKeyCandidate,
  getAppInfo,
  getCurrentQr,
  getHealth,
  getQrImageSvg,
  getStoredApiKey,
  getWhatsAppStatus,
  pairWhatsApp,
  rebindWhatsApp,
  sendMessage,
  setStoredApiKey,
  type WhatsAppBinding,
  type WhatsAppStatus,
} from "../../api.js";
import type { CopiedField, HealthState, LastMessage, Notice } from "./types.js";

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

function fallbackCopy(value: string): void {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function useDashboardController() {
  const [health, setHealth] = useState<HealthState>("checking");
  const [appId, setAppId] = useState("wa-gateway");
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [apiKeySource, setApiKeySource] = useState<AppInfoResponse["apiKeySource"]>("unset");
  const [credentialSetupRequired, setCredentialSetupRequired] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(getStoredApiKey());
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedField, setCopiedField] = useState<CopiedField>(null);

  const [status, setStatus] = useState<WhatsAppStatus>("disconnected");
  const [binding, setBinding] = useState<WhatsAppBinding>(unboundBinding);
  const [accountHealth, setAccountHealth] = useState<AccountHealthSnapshot | undefined>();
  const [hasQr, setHasQr] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);

  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [recipientApprovalPhone, setRecipientApprovalPhone] = useState<string | null>(null);
  const [recipientRefreshKey, setRecipientRefreshKey] = useState(0);
  const [lastMessage, setLastMessage] = useState<LastMessage | null>(null);

  const [notice, setNotice] = useState<Notice>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isRebinding, setIsRebinding] = useState(false);
  const [isPairing, setIsPairing] = useState(false);
  const [isRebindDialogOpen, setIsRebindDialogOpen] = useState(false);

  const isRefreshInFlight = useRef(false);
  const pollTimer = useRef<number | null>(null);
  const statusRef = useRef<WhatsAppStatus>("disconnected");

  const canSend = useMemo(
    () => isAuthenticated && status === "connected" && Boolean(phone.trim()) && Boolean(message.trim()) && !isSending,
    [isAuthenticated, isSending, message, phone, status],
  );

  const pairingInProgress =
    isAuthenticated && binding.state === "unbound" && (status === "connecting" || status === "qr");
  const canStartPairing = credentialSetupRequired || (isAuthenticated && binding.state === "unbound");
  const approvalRequired = Boolean(recipientApprovalPhone && recipientApprovalPhone === phone.trim());

  const loadAppInfo = useCallback(async () => {
    const info = await getAppInfo();

    setAppId(info.appId);
    setApiKeyConfigured(info.apiKeyConfigured);
    setApiKeySource(info.apiKeySource);
    setCredentialSetupRequired(info.credentialSetupRequired);
    setIsAuthenticated(info.authenticated);

    return info;
  }, []);

  const clearWhatsAppView = useCallback(() => {
    statusRef.current = "disconnected";
    setStatus("disconnected");
    setBinding(unboundBinding);
    setAccountHealth(undefined);
    setHasQr(false);
    setQrImage(null);
  }, []);

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

          statusRef.current = statusResult.status;
          setStatus(statusResult.status);
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
    [clearWhatsAppView, loadAppInfo],
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

  async function copyValue(value: string, field: Exclude<CopiedField, null>) {
    if (!value) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        fallbackCopy(value);
      }
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(null), 1600);
    } catch {
      setNotice({ type: "error", message: "Could not copy to clipboard. Select and copy the value manually." });
    }
  }

  async function handlePair() {
    if (health !== "ok") {
      setNotice({ type: "error", message: "Backend is unavailable. Start the backend, then try pairing again." });
      return;
    }

    setIsPairing(true);
    setNotice(null);

    try {
      if (!isAuthenticated) {
        if (!credentialSetupRequired) {
          setNotice({ type: "error", message: "Enter the existing API key before managing WhatsApp binding." });
          return;
        }

        const candidate = getStoredApiKey() || createApiKeyCandidate();
        setStoredApiKey(candidate);
        setApiKeyInput(candidate);

        try {
          const result = await bootstrapApp(candidate);

          if (!result.success) {
            setNotice({ type: "error", message: result.message });
            return;
          }

          setAppId(result.appId);
          setApiKeyConfigured(true);
          setApiKeySource("generated");
          setCredentialSetupRequired(false);
          setIsAuthenticated(true);
        } catch (error) {
          const apiError = error as { message?: string; error?: string };

          if (apiError.error === "APP_ALREADY_INITIALIZED") {
            const info = await loadAppInfo().catch(() => null);

            if (!info?.authenticated) {
              setStoredApiKey("");
              setApiKeyInput("");
              setNotice({
                type: "error",
                message: "Gateway credentials already exist. Enter the existing API key to continue.",
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

      statusRef.current = result.status;
      setStatus(result.status);
      setNotice({
        type: "success",
        message: result.status === "qr" ? "QR is ready. Scan it from WhatsApp Linked devices." : result.message,
      });
      await refresh({ showLoading: true });
    } catch (error) {
      const apiError = error as { message?: string; error?: string };
      setNotice({ type: "error", message: apiError.message ?? apiError.error ?? "Failed to start pairing" });
    } finally {
      setIsPairing(false);
    }
  }

  async function handleSaveApiKey() {
    const candidate = apiKeyInput.trim();

    if (!candidate) {
      setNotice({ type: "error", message: "Enter the API key first." });
      return;
    }

    setStoredApiKey(candidate);
    setNotice(null);

    try {
      const info = await loadAppInfo();

      if (!info.authenticated) {
        setStoredApiKey("");
        setNotice({ type: "error", message: "The backend rejected this API key. Check it and try again." });
        return;
      }

      setNotice({ type: "success", message: "API key verified for this browser session." });
      await refresh({ showLoading: true });
    } catch {
      setNotice({ type: "error", message: "The backend could not verify this API key." });
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

      setBinding(unboundBinding);
      setAccountHealth(undefined);
      setNotice({ type: "success", message: "Previous account unbound. Scan the new QR when it appears." });
      statusRef.current = result.status;
      setStatus(result.status);
      setIsRebindDialogOpen(false);
      await refresh({ showLoading: true });
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

  async function sendCurrentMessage(allowFirst = false) {
    const target = phone.trim();
    const text = message.trim();

    if (!target || !text || !isAuthenticated || status !== "connected" || isSending) {
      return;
    }

    setIsSending(true);
    setNotice(null);

    try {
      if (allowFirst) {
        await allowRecipient(target);
        setRecipientApprovalPhone(null);
        setRecipientRefreshKey((value) => value + 1);
      }

      const result = await sendMessage(target, text);

      if (result.success) {
        if (result.messageId) {
          setLastMessage({ id: result.messageId, status: result.status });
          setNotice({ type: "success", message: "Message accepted by the gateway. Live status is tracked below." });
        } else {
          setNotice({ type: "success", message: `Message ${result.status}.` });
        }

        setRecipientApprovalPhone(null);
        setMessage("");
      } else {
        setNotice({ type: "error", message: result.message });
      }
    } catch (error) {
      const apiError = error as { message?: string; error?: string };

      if (apiError.error === "RECIPIENT_NOT_ALLOWED") {
        setRecipientApprovalPhone(target);
        setNotice({
          type: "error",
          message: "This recipient is not allowed yet. Confirm permission, then use Allow & Send.",
        });
      } else if (apiError.error === "RECIPIENT_OPTED_OUT") {
        setRecipientApprovalPhone(null);
        setNotice({
          type: "error",
          message: "This recipient has opted out. Re-allow them only after renewed permission.",
        });
      } else {
        setRecipientApprovalPhone(null);
        setNotice({ type: "error", message: apiError.message ?? apiError.error ?? "Failed to send message" });
      }
    } finally {
      setIsSending(false);
      await refresh({ showLoading: false });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendCurrentMessage(false);
  }

  function handlePhoneChange(value: string) {
    setPhone(value);
    if (recipientApprovalPhone && recipientApprovalPhone !== value.trim()) {
      setRecipientApprovalPhone(null);
    }
  }

  const credentialHint = credentialSetupRequired
    ? "Created automatically once when you start the first WhatsApp pairing."
    : isAuthenticated && !apiKeyInput
      ? "Authenticated by secure browser cookie. The raw API key cannot be recovered from the server hash."
      : "Use this key for external REST API clients.";

  const connectionDescription =
    health === "error"
      ? "Backend is unavailable. In local development, make sure the backend is running on port 3000."
      : health === "checking"
        ? "Checking backend before pairing."
        : !credentialSetupRequired && !isAuthenticated
          ? "Enter the existing API key in Gateway Credentials to manage this gateway."
          : binding.state === "bound"
            ? status === "connected"
              ? `Bound to ${binding.phone} and connected.`
              : status === "connecting"
                ? `Reconnecting the bound account ${binding.phone}.`
                : `Bound to ${binding.phone}, but the session is currently disconnected.`
            : status === "qr"
              ? "Scan the QR below from WhatsApp → Linked devices."
              : status === "connecting"
                ? "Preparing a new WhatsApp pairing session."
                : "No WhatsApp account is bound to this gateway yet.";

  const pairButtonLabel = isPairing
    ? "Preparing QR"
    : pairingInProgress
      ? status === "qr"
        ? "QR ready"
        : "Preparing QR"
      : "Pair WhatsApp";

  return {
    health,
    appId,
    apiKeyConfigured,
    apiKeySource,
    credentialSetupRequired,
    isAuthenticated,
    apiKeyInput,
    showApiKey,
    copiedField,
    status,
    binding,
    accountHealth,
    hasQr,
    qrImage,
    phone,
    message,
    notice,
    isRefreshing,
    isSending,
    isRebinding,
    isPairing,
    isRebindDialogOpen,
    recipientApprovalPhone,
    recipientRefreshKey,
    lastMessage,
    canSend,
    canStartPairing,
    pairingInProgress,
    approvalRequired,
    credentialHint,
    connectionDescription,
    pairButtonLabel,
    refresh,
    setApiKeyInput,
    toggleApiKey: () => setShowApiKey((value) => !value),
    copyAppId: () => void copyValue(appId, "appId"),
    copyApiKey: () => void copyValue(apiKeyInput, "apiKey"),
    handlePair,
    handleSaveApiKey,
    handleRebind,
    openRebindDialog: () => setIsRebindDialogOpen(true),
    closeRebindDialog: () => setIsRebindDialogOpen(false),
    handlePhoneChange,
    setMessage,
    handleSubmit,
    allowAndSend: () => void sendCurrentMessage(true),
    handleRecipientAllowed: (allowedPhone: string) => {
      if (recipientApprovalPhone === allowedPhone) {
        setRecipientApprovalPhone(null);
      }
    },
  };
}
