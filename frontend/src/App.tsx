import { CheckCircle2, Link2Off, Loader2, RefreshCcw, Send, Server, Smartphone, WifiOff } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type WhatsAppStatus
} from "./api.js";
import { RebindSessionDialog } from "./components/RebindSessionDialog.js";

type HealthState = "checking" | "ok" | "error";

type Notice =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

const statusLabel: Record<WhatsAppStatus, string> = {
  connecting: "Connecting",
  qr: "Scan QR",
  connected: "Connected",
  disconnected: "Disconnected"
};

const panelClass = "mt-4 rounded-lg border border-[#d9e3df] bg-white p-5";
const inputClass =
  "w-full rounded-lg border border-[#cdd9d5] bg-white px-3 py-2.5 text-[#1f2a32] outline-none focus:border-[#2f8f71] focus:ring-3 focus:ring-[#cde9df]";
const secondaryButtonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#cdd9d5] bg-white px-3.5 text-[#1f2a32] disabled:cursor-not-allowed disabled:bg-[#eef3f1] disabled:text-[#667972]";
const visibleRefreshIntervalsMs: Record<WhatsAppStatus, number> = {
  connecting: 10000,
  qr: 10000,
  connected: 30000,
  disconnected: 20000
};
const hiddenRefreshIntervalMs = 60000;
const statusTextClass: Record<HealthState | WhatsAppStatus, string> = {
  checking: "text-[#667972]",
  ok: "text-[#176b55]",
  error: "text-[#a12d35]",
  connecting: "text-[#8a5a00]",
  qr: "text-[#8a5a00]",
  connected: "text-[#176b55]",
  disconnected: "text-[#a12d35]"
};

export function App() {
  const [health, setHealth] = useState<HealthState>("checking");
  const [appId, setAppId] = useState("wa-gateway");
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(getStoredApiKey());
  const [status, setStatus] = useState<WhatsAppStatus>("connecting");
  const [hasQr, setHasQr] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isRebinding, setIsRebinding] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isRebindDialogOpen, setIsRebindDialogOpen] = useState(false);
  const isRefreshInFlight = useRef(false);
  const pollTimer = useRef<number | null>(null);
  const statusRef = useRef<WhatsAppStatus>("connecting");
  const hasApiAccess = useRef(false);

  const canSend = useMemo(
    () => isAuthenticated && status === "connected" && Boolean(phone.trim()) && Boolean(message.trim()) && !isSending,
    [isAuthenticated, isSending, message, phone, status]
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

  const refresh = useCallback(async (options: { showLoading?: boolean } = {}) => {
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
      setHealth(healthResult.status === "ok" ? "ok" : "error");
    } catch {
      setHealth("error");
    }

    if (!hasApiAccess.current) {
      statusRef.current = "disconnected";
      setStatus("disconnected");
      setHasQr(false);
      setQrImage(null);
      isRefreshInFlight.current = false;

      if (showLoading) {
        setIsRefreshing(false);
      }

      return;
    }

    try {
      const [statusResult, qrResult] = await Promise.all([getWhatsAppStatus(), getCurrentQr()]);

      statusRef.current = statusResult.status;
      setStatus(statusResult.status);
      setHasQr(Boolean(qrResult.qr));
      setQrImage(qrResult.qr ? await getQrImageSvg() : null);
    } catch {
      statusRef.current = "disconnected";
      setStatus("disconnected");
      setHasQr(false);
      setQrImage(null);
    } finally {
      isRefreshInFlight.current = false;

      if (showLoading) {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    let disposed = false;

    function clearPollTimer() {
      if (pollTimer.current !== null) {
        window.clearTimeout(pollTimer.current);
        pollTimer.current = null;
      }
    }

    function getNextRefreshDelay() {
      return document.visibilityState === "hidden" ? hiddenRefreshIntervalMs : visibleRefreshIntervalsMs[statusRef.current];
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

    void loadAppInfo()
      .catch(() => undefined)
      .then(() => refresh({ showLoading: true }))
      .finally(() => {
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
  }, [loadAppInfo, refresh]);

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
          message: result.messageId ? `Message ${messageStatus}. ID: ${result.messageId}` : `Message ${messageStatus}.`
        });
        setMessage("");
      } else {
        setNotice({ type: "error", message: result.message });
      }
    } catch (error) {
      const apiError = error as { message?: string; error?: string };
      setNotice({
        type: "error",
        message: apiError.message ?? apiError.error ?? "Failed to send message"
      });
    } finally {
      setIsSending(false);
      await refresh();
    }
  }

  async function handleRebind() {
    setIsRebinding(true);
    setNotice(null);

    try {
      const result = await rebindWhatsApp();

      if (result.success) {
        setNotice({ type: "success", message: result.message });
        statusRef.current = result.status;
        setStatus(result.status);
        setIsRebindDialogOpen(false);
      } else {
        setNotice({ type: "error", message: result.message });
      }
    } catch (error) {
      const apiError = error as { message?: string; error?: string };
      setNotice({
        type: "error",
        message: apiError.message ?? apiError.error ?? "Failed to rebind WhatsApp session"
      });
    } finally {
      setIsRebinding(false);
      await refresh();
    }
  }

  async function handleSaveApiKey() {
    setStoredApiKey(apiKeyInput);

    try {
      const info = await loadAppInfo();
      setNotice({
        type: info.authenticated ? "success" : "error",
        message: info.authenticated
          ? "API key saved and verified in this browser session."
          : "API key saved, but backend rejected it. Check the key and try again."
      });
      await refresh({ showLoading: true });
    } catch {
      setNotice({
        type: "error",
        message: "API key saved, but the backend could not verify it."
      });
    }
  }

  async function handleBootstrap() {
    setIsBootstrapping(true);
    setNotice(null);

    try {
      const result = await bootstrapApp();

      if (result.success) {
        setAppId(result.appId);
        setApiKeyConfigured(true);
        setSetupRequired(false);
        setIsAuthenticated(true);
        hasApiAccess.current = true;
        setApiKeyInput(result.apiKey);
        setNotice({
          type: "success",
          message: "App initialized. Auth cookie set. Copy the API key now if an external API client needs it."
        });
        await refresh({ showLoading: true });
      } else {
        setNotice({ type: "error", message: result.message });
      }
    } catch (error) {
      const apiError = error as { message?: string; error?: string };
      setNotice({
        type: "error",
        message: apiError.message ?? apiError.error ?? "Failed to initialize app"
      });
    } finally {
      setIsBootstrapping(false);
    }
  }

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
          {status === "connected" ? <CheckCircle2 size={18} /> : status === "disconnected" ? <WifiOff size={18} /> : <Smartphone size={18} />}
          <div>
            <span className="block text-[13px] text-[#667972]">WhatsApp</span>
            <strong className={`mt-0.5 block ${statusTextClass[status]}`}>{statusLabel[status]}</strong>
          </div>
        </div>
      </section>

      <section className={`${panelClass} grid grid-cols-[minmax(0,1fr)_minmax(220px,320px)_auto] items-end gap-4 max-[680px]:flex max-[680px]:flex-col max-[680px]:items-start`}>
        <div>
          <h2 className="mb-2 text-xl">Gateway</h2>
          <p className="mb-0 text-[#667972]">
            App ID: <strong>{appId}</strong> - API key {apiKeyConfigured ? "configured" : "not configured"} -{" "}
            {isAuthenticated ? "authenticated" : "not authenticated"}
          </p>
        </div>
        <label className="min-w-0">
          <span className="mb-1.5 block text-sm font-bold text-[#405149]">API Key</span>
          <input
            className={inputClass}
            value={apiKeyInput}
            onChange={(event) => setApiKeyInput(event.target.value)}
            placeholder="Enter API key"
            type="password"
            autoComplete="off"
          />
        </label>
        <button className={secondaryButtonClass} type="button" onClick={() => void handleSaveApiKey()}>
          Save key
        </button>
      </section>

      {apiKeyConfigured && !isAuthenticated && !setupRequired ? (
        <section className={`${panelClass} border-[#e4c46d] bg-[#fff8e1]`}>
          <h2 className="mb-2 text-xl">Authentication Required</h2>
          <p className="mb-0 text-[#6f5a14]">
            This backend already has an API key. Paste it above for this tab, or open the same browser used for setup.
          </p>
        </section>
      ) : null}

      {setupRequired ? (
        <section className={`${panelClass} flex items-center justify-between gap-4 border-[#e4c46d] bg-[#fff8e1] max-[680px]:flex-col max-[680px]:items-start`}>
          <div>
            <h2 className="mb-2 text-xl">Initial Setup</h2>
            <p className="mb-0 text-[#6f5a14]">Generate an API key in this app before binding WhatsApp or sending messages.</p>
          </div>
          <button
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#176b55] px-3.5 text-white disabled:cursor-not-allowed disabled:bg-[#91aaa0] disabled:text-[#ecf1ef]"
            type="button"
            onClick={() => void handleBootstrap()}
            disabled={isBootstrapping}
          >
            {isBootstrapping ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
            <span>{isBootstrapping ? "Initializing" : "Initialize app"}</span>
          </button>
        </section>
      ) : null}

      <section className={`${panelClass} flex items-center justify-between gap-4 max-[680px]:flex-col max-[680px]:items-start`}>
        <div>
          <h2 className="mb-2 text-xl">Session</h2>
          <p className="mb-0 text-[#667972]">Clear the current WhatsApp binding and scan a new QR for another account.</p>
        </div>
        <button
          className={`${secondaryButtonClass} border-[#e9b7bd] text-[#842029]`}
          type="button"
          onClick={() => setIsRebindDialogOpen(true)}
          disabled={isRebinding || !isAuthenticated}
        >
          {isRebinding ? <Loader2 className="animate-spin" size={18} /> : <Link2Off size={18} />}
          <span>{isRebinding ? "Rebinding" : "Bind another account"}</span>
        </button>
      </section>

      {hasQr && qrImage && status !== "connected" ? (
        <section className={`${panelClass} grid grid-cols-[minmax(0,1fr)_220px] items-center gap-5 max-[680px]:grid-cols-1`}>
          <div>
            <h2 className="mb-2 text-xl">QR Authentication</h2>
            <p className="mb-0 text-[#667972]">Open WhatsApp linked devices and scan this code.</p>
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

          <button
            className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-lg bg-[#176b55] px-4 text-white disabled:cursor-not-allowed disabled:bg-[#91aaa0] disabled:text-[#ecf1ef]"
            type="submit"
            disabled={!canSend}
          >
            {isSending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            <span>{isSending ? "Sending" : "Send"}</span>
          </button>
        </form>

        {notice ? (
          <p
            className={`mt-4 rounded-lg px-3.5 py-3 font-bold ${
              notice.type === "success" ? "bg-[#dff3e9] text-[#0f5138]" : "bg-[#f8d7da] text-[#842029]"
            }`}
          >
            {notice.message}
          </p>
        ) : null}
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
