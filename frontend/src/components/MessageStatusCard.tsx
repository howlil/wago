import { CheckCircle2, Clock3, Loader2, RefreshCcw, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getMessageStatus, type MessageStatusResponse } from "../api.js";

type DeliveryStatus = Extract<MessageStatusResponse, { success: true }>;

type MessageStatusCardProps = {
  messageId: string;
  initialStatus: "pending" | "accepted" | "rejected";
};

const POLL_INTERVAL_MS = 1500;
const AUTO_POLL_WINDOW_MS = 30000;

function statusClass(status: DeliveryStatus["status"]): string {
  if (status === "accepted") {
    return "text-[#176b55]";
  }

  if (status === "rejected") {
    return "text-[#a12d35]";
  }

  return "text-[#8a5a00]";
}

export function MessageStatusCard({ messageId, initialStatus }: MessageStatusCardProps) {
  const [delivery, setDelivery] = useState<DeliveryStatus>({
    success: true,
    id: messageId,
    to: "",
    status: initialStatus,
    updatedAt: new Date().toISOString(),
  });
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollStartedAt = useRef(Date.now());

  useEffect(() => {
    setDelivery({
      success: true,
      id: messageId,
      to: "",
      status: initialStatus,
      updatedAt: new Date().toISOString(),
    });
    setError(null);
    pollStartedAt.current = Date.now();
  }, [initialStatus, messageId]);

  useEffect(() => {
    if (delivery.status !== "pending") {
      return;
    }

    let disposed = false;
    let timer: number | undefined;

    async function poll() {
      if (disposed || Date.now() - pollStartedAt.current > AUTO_POLL_WINDOW_MS) {
        return;
      }

      try {
        const result = await getMessageStatus(messageId);
        if (!disposed && result.success) {
          setDelivery(result);
          setError(null);
        }
      } catch (caught) {
        const apiError = caught as { message?: string };
        if (!disposed) {
          setError(apiError.message ?? "Could not refresh message status.");
        }
      }

      if (!disposed) {
        timer = window.setTimeout(() => void poll(), POLL_INTERVAL_MS);
      }
    }

    timer = window.setTimeout(() => void poll(), POLL_INTERVAL_MS);

    return () => {
      disposed = true;
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [delivery.status, messageId]);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);

    try {
      const result = await getMessageStatus(messageId);
      if (result.success) {
        setDelivery(result);
      }
    } catch (caught) {
      const apiError = caught as { message?: string };
      setError(apiError.message ?? "Could not refresh message status.");
    } finally {
      setRefreshing(false);
    }
  }

  const icon =
    delivery.status === "accepted" ? (
      <CheckCircle2 size={18} />
    ) : delivery.status === "rejected" ? (
      <XCircle size={18} />
    ) : (
      <Clock3 size={18} />
    );

  return (
    <section className="mt-4 rounded-lg border border-[#d9e3df] bg-white p-5">
      <div className="flex items-start justify-between gap-4 max-[560px]:flex-col">
        <div>
          <h2 className="mb-1 text-xl">Last Message Status</h2>
          <p className="m-0 text-sm text-[#667972]">
            Tracks Baileys acceptance or rejection for the latest message. This is not a read receipt.
          </p>
        </div>
        <button
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#cdd9d5] bg-white px-3.5 text-[#1f2a32] disabled:cursor-not-allowed disabled:bg-[#eef3f1]"
          type="button"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
        >
          {refreshing ? <Loader2 className="animate-spin" size={16} /> : <RefreshCcw size={16} />}
          Refresh
        </button>
      </div>

      <div className="mt-4 rounded-lg bg-[#f7faf9] p-3.5">
        <div className={`flex items-center gap-2 font-bold ${statusClass(delivery.status)}`}>
          {icon}
          <span className="capitalize">{delivery.status}</span>
        </div>
        <span className="mt-2 block break-all font-mono text-xs text-[#667972]">{messageId}</span>
        {delivery.to ? <span className="mt-1 block text-xs text-[#667972]">To {delivery.to}</span> : null}
        {delivery.message ? <span className="mt-1 block text-xs text-[#842029]">{delivery.message}</span> : null}
        {error ? <span className="mt-1 block text-xs text-[#842029]">{error}</span> : null}
      </div>
    </section>
  );
}
