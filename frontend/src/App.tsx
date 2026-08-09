import {
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Link2Off,
  Loader2,
  QrCode,
  RefreshCcw,
  Send,
  Server,
  Smartphone,
  WifiOff,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  bootstrapApp,
  getAppInfo,
  getCurrentQr,
  getHealth,
  getMessageStatus,
  getQrImageSvg,
  getStoredApiKey,
  getWhatsAppStatus,
  rebindWhatsApp,
  sendMessage,
  setStoredApiKey,
  type WhatsAppStatus,
} from "./api.js";
import { RebindSessionDialog } from "./components/RebindSessionDialog.js";

type HealthState = "checking" | "ok" | "error";
type Notice = { type: "success"; message: string } | { type: "error"; message: string } | null;
type CopiedField = "appId" | "apiKey" | null;

const statusLabel: Record<WhatsAppStatus, string> = {
  connecting: "Connecting",
  qr: "Scan QR",
  connected: "Connected",
  disconnected: "Disconnected",
};

const panelClass = "mt-4 rounded-lg border border-[#d9e3df] bg-white p-5";
const inputClass =
  "w-full rounded-lg border border-[#cdd9d5] bg-white px-3 py-2.5 text-[#1f2a32] outline-none focus:border-[#2f8f71] focus:ring-3 focus:ring-[#cde9df]";
const secondaryButtonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#cdd9d5] bg-white px-3.5 text-[#1f2a32] disabled:cursor-not-allowed disabled:bg-[#eef3f1] disabled:text-[#667972]";
const primaryButtonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#176b55] px-3.5 text-white disabled:cursor-not-allowed disabled:bg-[#91aaa0] disabled:text-[#ecf1ef]";
const visibleRefreshIntervalsMs: Record<WhatsAppStatus, number> = {
  connecting: 5000,
  qr: 5000,
  connected: 30000,
  disconnected: 15000,
};
const hiddenRefreshIntervalMs = 60000;
const statusTextClass: Record<HealthState | WhatsAppStatus, string> = {
  checking: "text-[#667972]",
  ok: "text-[#176b55]",
  error: "text-[#a12d35]",
  connecting: "text-[#8a5a00]",
  qr: "text-[#8a5a00]",
  connected: "text-[#176b55]",
  disconnected: "text-[#a12d35]",
};

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

export function App() {
  const [health, setHealth] = useState<HealthState>("checking");
  const [appId, setAppId] = useState("wa-gateway");
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(getStoredApiKey());
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedField, setCopiedField] = useState<CopiedField>(null);
  const [status, setStatus] = useState<WhatsAppStatus>("connecting");
  const [hasQr, setHasQr] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isRebinding, setIsRebinding] = useState(false);
  const [isPairing, setIsPairing] = useState(false);
  const [isRebindDialogOpen, setIsRebindDialogOpen] = useState(false);
  const isRefreshInFlight = useRef(false);
  const pollTimer = useRef<number | null>(null);
  const statusRef = useRef<WhatsAppStatus>("connecting");
  const hasApiAccess = useRef(false);

  const canSend = useMemo(
    () => isAuthenticated && status === "connected" && Boolean(phone.trim()) && Boolean(message.trim()) && !isSending,
    [isAuthenticated, isSending, message, phone, status],
  );

  const loadAppInfo = useCallback(async () => {
    const info = await getAppInfo();

    setAppId(info.appId);
    setApiKeyConfigured(info.apiKeyConfigured);
    setSetupRequired(info.setupRequired);
    setIsAuthenticated(info.authenticated);
    hasApiAccess.current = info.authenticated;

    return info;
  }, []);

  const clearWhatsAppView = useCallback(() => {
    statusRef.current = "disconnected";
    setStatus("disconnected");
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
        const healthResult = await getHealth();
        const backendHealthy = healthResult.status === "ok";
        setHealth(backendHealthy ? "ok" : "error");

        if (!backendHealthy) {
          hasApiAccess.current = false;
          clearWhatsAppView();
          return;
        }

        const info = await loadAppInfo();

        if (!info.authenticated) {
          clearWhatsAppView();
          return;
        }

        const [statusResult, qrResult] = await Promise.all([getWhatsAppStatus(), getCurrentQr()]);

        statusRef.current = statusResult.status;
        setStatus(statusResult.status);
        setHasQr(Boolean(qrResult.qr));
        setQrImage(qrResult.qr ? await getQrImageSvg() : null);
      } catch {
        setHealth("error");
        hasApiAccess.current = false;
        clearWhatsAppView();
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
      const result = await bootstrapApp();

      if (!result.success) {
        setNotice({ type: "error", message: result.message });
        return;
      }

      setStoredApiKey(result.apiKey);
      setApiKeyInput(result.apiKey);
      setAppId(result.appId);
      setApiKeyConfigured(true);
      setSetupRequired(false);
      setIsAuthenticated(true);
      hasApiAccess.current = true;
      setNotice({
        type: "success",
        message: "Gateway credentials generated. Copy the API key, then scan the WhatsApp QR below.",
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
        hasApiAccess.current = false;
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

      setNotice({ type: "success", message: "New pairing session started. Scan the new QR when it appears." });
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSend) {
      return;
    }

    setIsSending(true);
    setNotice(null);

    try {
      const result = await sendMessage(phone, message);

      if (result.success) {
        let messageStatus: string = result.status;

        if (result.messageId) {
          const statusResult = await getMessageStatus(result.messageId).catch(() => null);
          if (statusResult?.success) {
            messageStatus = statusResult.status;
          }
        }

        setNotice({
          type: "success",
          message: result.messageId ? `Message ${messageStatus}. ID: ${result.messageId}` : `Message ${messageStatus}.`,
        });
        setMessage("");
      } else {
        setNotice({ type: "error", message: result.message });
      }
    } catch (error) {
      const apiError = error as { message?: string; error?: string };
      setNotice({ type: "error", message: apiError.message ?? apiError.error ?? "Failed to send message" });
    } finally {
      setIsSending(false);
      await refresh({ showLoading: false });
    }
  }

  const credentialHint = setupRequired
    ? "Created automatically when you pair WhatsApp."
    : isAuthenticated && !apiKeyInput
      ? "Authenticated by secure browser cookie. The raw key is not stored by the backend."
      : "Use this key for external REST API clients.";

  const connectionDescription =
    health === "error"
      ? "Backend is unavailable. In local development, make sure the backend is running on port 3000."
      : health === "checking"
        ? "Checking backend before pairing."
        : setupRequired
          ? "Pairing creates the App ID and API key automatically, then shows the WhatsApp QR."
          : !isAuthenticated
            ? "Enter the existing API key above to manage this gateway."
            : status === "connected"
              ? "WhatsApp is connected and ready."
              : status === "qr"
                ? "Scan the QR below from WhatsApp → Linked devices."
                : status === "connecting"
                  ? "Preparing the WhatsApp session and QR."
                  : "WhatsApp is disconnected. Start a new pairing session if you need a fresh QR.";

  return (
    <main className="mx-auto max-w-[920px] px-4 py-8 max-[680px]:px-3 max-[680px]:py-5">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="mb-1.5 text-[13px] font-bold uppercase text-[#557067]">WhatsApp Gateway</p>
          <h1 className="m-0 text-[34px] leading-tight max-[680px]:text-[28px]">Gateway Control</h1>
        </div>
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#1f2a32] shadow-[0_1px_8px_rgb(31_42_50_/_10%)]"
          type="button"
          onClick={() => void refresh({ showLoading: true })}
          aria-label="Refresh status"
        >
          {isRefreshing ? <Loader2 className="animate-spin" size={18} /> : <RefreshCcw size={18} />}
        </button>
      </header>

      <section className="mb-4 grid grid-cols-2 gap-3 max-[680px]:grid-cols-1">
        <div className="flex min-h-[72px] items-center gap-3 rounded-lg border border-[#d9e3df] bg-white p-4">
          <Server size={18} />
          <div>
            <span className="block text-[13px] text-[#667972]">Backend</span>
            <strong className={`mt-0.5 block ${statusTextClass[health]}`}>
              {health === "ok" ? "Healthy" : health === "checking" ? "Checking" : "Unavailable"}
            </strong>
          </div>
        </div>
        <div className="flex min-h-[72px] items-center gap-3 rounded-lg border border-[#d9e3df] bg-white p-4">
          {status === "connected" ? (
            <CheckCircle2 size={18} />
          ) : status === "disconnected" ? (
            <WifiOff size={18} />
          ) : (
            <Smartphone size={18} />
          )}
          <div>
            <span className="block text-[13px] text-[#667972]">WhatsApp</span>
            <strong className={`mt-0.5 block ${statusTextClass[status]}`}>{statusLabel[status]}</strong>
          </div>
        </div>
      </section>

      {notice ? (
        <p
          className={`mb-4 rounded-lg px-3.5 py-3 font-bold ${
            notice.type === "success" ? "bg-[#dff3e9] text-[#0f5138]" : "bg-[#f8d7da] text-[#842029]"
          }`}
        >
          {notice.message}
        </p>
      ) : null}

      <section className={panelClass}>
        <div className="mb-4 flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#edf6f2] text-[#176b55]">
            <KeyRound size={18} />
          </span>
          <div>
            <h2 className="mb-1 text-xl">Gateway Credentials</h2>
            <p className="m-0 text-sm text-[#667972]">Generated once for this gateway and independent from WhatsApp auth.</p>
          </div>
        </div>

        <div className="grid gap-4">
          <label>
            <span className="mb-1.5 block text-sm font-bold text-[#405149]">App ID</span>
            <div className="flex gap-2 max-[560px]:flex-col">
              <input className={`${inputClass} font-mono`} value={appId} readOnly aria-label="App ID" />
              <button className={secondaryButtonClass} type="button" onClick={() => void copyValue(appId, "appId")}>
                {copiedField === "appId" ? <Check size={17} /> : <Copy size={17} />}
                <span>{copiedField === "appId" ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </label>

          <label>
            <span className="mb-1.5 block text-sm font-bold text-[#405149]">API Key</span>
            <div className="flex gap-2 max-[560px]:flex-col">
              <div className="relative min-w-0 flex-1">
                <input
                  className={`${inputClass} pr-11 font-mono`}
                  value={apiKeyInput}
                  onChange={(event) => setApiKeyInput(event.target.value)}
                  placeholder={
                    setupRequired
                      ? "Generated automatically when pairing"
                      : isAuthenticated
                        ? "Hidden after setup"
                        : "Enter existing API key"
                  }
                  type={showApiKey ? "text" : "password"}
                  readOnly={setupRequired || isAuthenticated}
                  autoComplete="off"
                  aria-label="API Key"
                />
                {apiKeyInput ? (
                  <button
                    className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-[#667972]"
                    type="button"
                    onClick={() => setShowApiKey((value) => !value)}
                    aria-label={showApiKey ? "Hide API key" : "Show API key"}
                  >
                    {showApiKey ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                ) : null}
              </div>

              {!isAuthenticated && apiKeyConfigured ? (
                <button className={secondaryButtonClass} type="button" onClick={() => void handleSaveApiKey()}>
                  Use key
                </button>
              ) : (
                <button
                  className={secondaryButtonClass}
                  type="button"
                  onClick={() => void copyValue(apiKeyInput, "apiKey")}
                  disabled={!apiKeyInput}
                >
                  {copiedField === "apiKey" ? <Check size={17} /> : <Copy size={17} />}
                  <span>{copiedField === "apiKey" ? "Copied" : "Copy"}</span>
                </button>
              )}
            </div>
            <span className="mt-1.5 block text-xs text-[#667972]">{credentialHint}</span>
          </label>
        </div>
      </section>

      <section className={`${panelClass} flex items-center justify-between gap-4 max-[680px]:flex-col max-[680px]:items-start`}>
        <div>
          <h2 className="mb-2 text-xl">{setupRequired ? "Connect WhatsApp" : "WhatsApp Connection"}</h2>
          <p className="mb-0 text-[#667972]">{connectionDescription}</p>
        </div>

        {setupRequired ? (
          <button className={primaryButtonClass} type="button" onClick={() => void handlePair()} disabled={health !== "ok" || isPairing}>
            {isPairing ? <Loader2 className="animate-spin" size={18} /> : <QrCode size={18} />}
            <span>{isPairing ? "Preparing QR" : "Pair WhatsApp"}</span>
          </button>
        ) : isAuthenticated ? (
          <button
            className={`${secondaryButtonClass} border-[#e9b7bd] text-[#842029]`}
            type="button"
            onClick={() => setIsRebindDialogOpen(true)}
            disabled={health !== "ok" || isRebinding}
          >
            {isRebinding ? <Loader2 className="animate-spin" size={18} /> : <Link2Off size={18} />}
            <span>{status === "connected" ? "Change account" : "Start new pairing"}</span>
          </button>
        ) : null}
      </section>

      {hasQr && qrImage && status !== "connected" ? (
        <section className={`${panelClass} grid grid-cols-[minmax(0,1fr)_220px] items-center gap-5 max-[680px]:grid-cols-1`}>
          <div>
            <h2 className="mb-2 text-xl">Scan WhatsApp QR</h2>
            <p className="mb-0 text-[#667972]">Open WhatsApp → Linked devices → Link a device, then scan this code.</p>
          </div>
          <img
            className="h-[220px] w-[220px] rounded-lg border border-[#d9e3df] bg-white max-[680px]:aspect-square max-[680px]:h-auto max-[680px]:w-[min(100%,260px)]"
            src={`data:image/svg+xml;utf8,${encodeURIComponent(qrImage)}`}
            alt="WhatsApp login QR"
          />
        </section>
      ) : null}

      <section className={panelClass}>
        <div>
          <h2 className="mb-2 text-xl">Send Message</h2>
          <p className="mb-0 text-[#667972]">
            {status === "connected" ? "Ready to send through the connected session." : "Connect WhatsApp before sending."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-[18px] grid gap-3.5">
          <label>
            <span className="mb-1.5 block text-sm font-bold text-[#405149]">Phone</span>
            <input
              className={inputClass}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="628xxxxxxxxxx"
              autoComplete="tel"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-sm font-bold text-[#405149]">Message</span>
            <textarea
              className={`${inputClass} resize-y`}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Hello"
              rows={5}
            />
          </label>

          <button className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-lg bg-[#176b55] px-4 text-white disabled:cursor-not-allowed disabled:bg-[#91aaa0] disabled:text-[#ecf1ef]" type="submit" disabled={!canSend}>
            {isSending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            <span>{isSending ? "Sending" : "Send"}</span>
          </button>
        </form>
      </section>

      <RebindSessionDialog
        isOpen={isRebindDialogOpen}
        isRebinding={isRebinding}
        onCancel={() => setIsRebindDialogOpen(false)}
        onConfirm={() => void handleRebind()}
      />
    </main>
  );
}
