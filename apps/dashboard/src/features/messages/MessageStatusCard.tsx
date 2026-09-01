import { CheckCircle2, Clock3, Loader2, RefreshCcw, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  cardBodyClass,
  secondaryButtonClass,
  sectionDescriptionClass,
  sectionTitleClass,
} from "../../shared/ui/classes.js";
import { getMessageDiagnostics, type MessageDiagnosticResponse } from "./api.js";

type DeliveryDiagnostic = Extract<MessageDiagnosticResponse, { success: true }>;

type MessageStatusCardProps = {
  messageId: string;
  initialStatus: "pending" | "accepted" | "rejected";
};

const POLL_INTERVAL_MS = 1500;
const AUTO_POLL_WINDOW_MS = 30000;

function statusClass(status: DeliveryDiagnostic["status"]): string {
  if (status === "accepted") {
    return "text-wago-brand";
  }
  if (status === "rejected") {
    return "text-wago-danger";
  }
  return "text-wago-warning";
}

function dispatchLabel(dispatchState: DeliveryDiagnostic["dispatchState"]): string {
  if (dispatchState === "prepared") return "Prepared";
  if (dispatchState === "submitting") return "Submitting";
  if (dispatchState === "indeterminate") return "Indeterminate";
  return "Submitted";
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function MessageStatusCard({ messageId, initialStatus }: MessageStatusCardProps) {
  const initialTimestamp = new Date().toISOString();
  const [delivery, setDelivery] = useState<DeliveryDiagnostic>({
    success: true,
    id: messageId,
    status: initialStatus,
    dispatchState: "submitted",
    createdAt: initialTimestamp,
    updatedAt: initialTimestamp,
    webhook: null,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollStartedAt = useRef(Date.now());

  useEffect(() => {
    const now = new Date().toISOString();
    setDelivery({
      success: true,
      id: messageId,
      status: initialStatus,
      dispatchState: "submitted",
      createdAt: now,
      updatedAt: now,
      webhook: null,
    });
    setError(null);
    pollStartedAt.current = Date.now();
  }, [initialStatus, messageId]);

  useEffect(() => {
    if (delivery.status !== "pending" || delivery.dispatchState === "indeterminate") {
      return;
    }

    let disposed = false;
    let timer: number | undefined;

    async function poll() {
      if (disposed || Date.now() - pollStartedAt.current > AUTO_POLL_WINDOW_MS) {
        return;
      }

      try {
        const result = await getMessageDiagnostics(messageId);
        if (!disposed && result.success) {
          setDelivery(result);
          setError(null);
        }
      } catch (caught) {
        const apiError = caught as { message?: string };
        if (!disposed) {
          setError(apiError.message ?? "Could not refresh message diagnostics.");
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
  }, [delivery.dispatchState, delivery.status, messageId]);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);

    try {
      const result = await getMessageDiagnostics(messageId);
      if (result.success) {
        setDelivery(result);
      }
    } catch (caught) {
      const apiError = caught as { message?: string };
      setError(apiError.message ?? "Could not refresh message diagnostics.");
    } finally {
      setRefreshing(false);
    }
  }

  const icon =
    delivery.status === "accepted" ? (
      <CheckCircle2 size={15} />
    ) : delivery.status === "rejected" ? (
      <XCircle size={15} />
    ) : (
      <Clock3 size={15} />
    );
  const terminalAt = delivery.acceptedAt ?? delivery.rejectedAt;

  return (
    <section className={cardBodyClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={sectionTitleClass}>Message diagnostics</h2>
          <p className={sectionDescriptionClass}>Durable gateway trace, not a delivery or WhatsApp read receipt.</p>
        </div>
        <button
          className={secondaryButtonClass}
          type="button"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
        >
          {refreshing ? <Loader2 className="animate-spin" size={13} /> : <RefreshCcw size={13} />}
          Refresh
        </button>
      </div>

      <dl className="mt-3 grid gap-2 border-t border-[#e7ebe8] pt-3 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-[#818b86]">Status</dt>
          <dd className={`mt-0.5 flex items-center gap-2 font-semibold ${statusClass(delivery.status)}`}>
            {icon}
            <span className="capitalize">{delivery.status}</span>
          </dd>
        </div>
        <div>
          <dt className="text-[#818b86]">Transport state</dt>
          <dd className="mt-0.5 font-medium text-[#33413a]">{dispatchLabel(delivery.dispatchState)}</dd>
        </div>
        <div>
          <dt className="text-[#818b86]">Webhook</dt>
          <dd className="mt-0.5 font-medium text-[#33413a]">
            {delivery.webhook
              ? `${delivery.webhook.status} · ${delivery.webhook.attemptCount} attempt(s)`
              : "Not queued"}
          </dd>
        </div>
        <div>
          <dt className="text-[#818b86]">Intent recorded</dt>
          <dd className="mt-0.5 text-[#33413a]">{formatTimestamp(delivery.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-[#818b86]">Accepted / rejected</dt>
          <dd className="mt-0.5 text-[#33413a]">{formatTimestamp(terminalAt)}</dd>
        </div>
      </dl>

      <div className="mt-3 border-t border-[#e7ebe8] pt-3">
        <div className="text-[10px] uppercase tracking-[0.12em] text-[#818b86]">Message ID</div>
        <div className="mt-1 max-w-full truncate font-mono text-[10px] text-[#5f6b65]">{messageId}</div>
      </div>

      {delivery.dispatchState === "indeterminate" ? (
        <p className="mb-0 mt-2 text-xs text-wago-warning">
          Wago cannot determine whether WhatsApp accepted this submission, so this message will not be retried
          automatically.
        </p>
      ) : null}
      {delivery.message ? <p className="mb-0 mt-2 text-xs text-wago-danger">{delivery.message}</p> : null}
      {delivery.webhook?.lastErrorCode ? (
        <p className="mb-0 mt-2 text-xs text-wago-danger">Webhook: {delivery.webhook.lastErrorCode}</p>
      ) : null}
      {error ? <p className="mb-0 mt-2 text-xs text-wago-danger">{error}</p> : null}
    </section>
  );
}
