import { CheckCircle2, Loader2, RefreshCcw, Send, Server, Smartphone, WifiOff } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  getCurrentQr,
  getHealth,
  getQrImageUrl,
  getWhatsAppStatus,
  sendMessage,
  type WhatsAppStatus
} from "./api.js";

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

export function App() {
  const [health, setHealth] = useState<HealthState>("checking");
  const [status, setStatus] = useState<WhatsAppStatus>("connecting");
  const [hasQr, setHasQr] = useState(false);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [qrVersion, setQrVersion] = useState(0);

  const canSend = useMemo(() => status === "connected" && Boolean(phone.trim()) && Boolean(message.trim()) && !isSending, [
    isSending,
    message,
    phone,
    status
  ]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const [healthResult, statusResult, qrResult] = await Promise.all([
        getHealth(),
        getWhatsAppStatus(),
        getCurrentQr()
      ]);

      setHealth(healthResult.status === "ok" ? "ok" : "error");
      setStatus(statusResult.status);
      setHasQr(Boolean(qrResult.qr));
      setQrVersion((current) => current + 1);
    } catch {
      setHealth("error");
      setStatus("disconnected");
      setHasQr(false);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);

    return () => window.clearInterval(timer);
  }, [refresh]);

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
        setNotice({
          type: "success",
          message: result.messageId
            ? `Message accepted by gateway. ID: ${result.messageId}`
            : "Message accepted by gateway."
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

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">WhatsApp Gateway</p>
          <h1>Gateway Control</h1>
        </div>
        <button className="iconButton" type="button" onClick={refresh} aria-label="Refresh status">
          {isRefreshing ? <Loader2 className="spin" size={18} /> : <RefreshCcw size={18} />}
        </button>
      </header>

      <section className="statusGrid">
        <div className="statusItem">
          <Server size={18} />
          <div>
            <span>Backend</span>
            <strong className={health === "ok" ? "good" : health === "checking" ? "muted" : "bad"}>
              {health === "ok" ? "Healthy" : health === "checking" ? "Checking" : "Unavailable"}
            </strong>
          </div>
        </div>
        <div className="statusItem">
          {status === "connected" ? <CheckCircle2 size={18} /> : status === "disconnected" ? <WifiOff size={18} /> : <Smartphone size={18} />}
          <div>
            <span>WhatsApp</span>
            <strong className={status === "connected" ? "good" : status === "disconnected" ? "bad" : "warn"}>
              {statusLabel[status]}
            </strong>
          </div>
        </div>
      </section>

      {hasQr && status !== "connected" ? (
        <section className="panel qrPanel">
          <div>
            <h2>QR Authentication</h2>
            <p>Open WhatsApp linked devices and scan this code.</p>
          </div>
          <img src={`${getQrImageUrl()}?v=${qrVersion}`} alt="WhatsApp login QR" />
        </section>
      ) : null}

      <section className="panel">
        <div className="sectionHeading">
          <h2>Send Message</h2>
          <p>{status === "connected" ? "Ready to send through the connected session." : "Connect WhatsApp before sending."}</p>
        </div>

        <form onSubmit={handleSubmit} className="messageForm">
          <label>
            <span>Phone</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="628xxxxxxxxxx"
              autoComplete="tel"
            />
          </label>

          <label>
            <span>Message</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Hello"
              rows={5}
            />
          </label>

          <button className="primaryButton" type="submit" disabled={!canSend}>
            {isSending ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
            <span>{isSending ? "Sending" : "Send"}</span>
          </button>
        </form>

        {notice ? <p className={`notice ${notice.type}`}>{notice.message}</p> : null}
      </section>
    </main>
  );
}
