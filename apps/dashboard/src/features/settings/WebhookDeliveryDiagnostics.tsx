import { ChevronRight, RefreshCcw, RotateCcw } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { secondaryButtonClass } from "../../shared/ui/classes.js";
import {
  getWebhookDeliveries,
  getWebhookDelivery,
  redeliverWebhookDelivery,
  type WebhookDelivery,
  type WebhookDeliveryAttempt,
  type WebhookDeliveryDetail,
} from "./api.js";

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Webhook delivery diagnostics could not be loaded.";
}

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function attemptLabel(attempt: WebhookDeliveryAttempt): string {
  if (attempt.outcome === "succeeded") return "Succeeded";
  if (attempt.outcome === "retryable_failure") return "Retryable failure";
  if (attempt.outcome === "permanent_failure") return "Permanent failure";
  if (attempt.outcome === "interrupted") return "Interrupted";
  return "In progress";
}

function statusClass(status: WebhookDelivery["status"]): string {
  if (status === "delivered") return "text-wago-positive";
  if (status === "failed" || status === "expired") return "text-wago-danger";
  return "text-wago-warning";
}

export function WebhookDeliveryDiagnostics() {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [selected, setSelected] = useState<WebhookDeliveryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [redelivering, setRedelivering] = useState(false);
  const [error, setError] = useState("");

  async function loadDeliveries(): Promise<void> {
    const result = await getWebhookDeliveries(10);
    setDeliveries(result.deliveries);
  }

  useEffect(() => {
    let active = true;
    void getWebhookDeliveries(10)
      .then((result) => {
        if (active) setDeliveries(result.deliveries);
      })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function refresh(): Promise<void> {
    setRefreshing(true);
    setError("");
    try {
      await loadDeliveries();
      if (selected) {
        const detail = await getWebhookDelivery(selected.id);
        setSelected(detail.delivery);
      }
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setRefreshing(false);
    }
  }

  async function inspect(id: string): Promise<void> {
    if (selected?.id === id) {
      setSelected(null);
      return;
    }
    setError("");
    try {
      const result = await getWebhookDelivery(id);
      setSelected(result.delivery);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function redeliver(): Promise<void> {
    if (!selected?.redeliveryAvailable) return;
    setRedelivering(true);
    setError("");
    try {
      await redeliverWebhookDelivery(selected.id);
      await loadDeliveries();
      const detail = await getWebhookDelivery(selected.id);
      setSelected(detail.delivery);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setRedelivering(false);
    }
  }

  return (
    <div className="mt-5 border-t border-wago-line pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="m-0 text-xs font-semibold text-wago-ink">Delivery activity</h3>
          <p className="mb-0 mt-0.5 text-xs leading-5 text-wago-muted">
            Recent callback state and attempt evidence. Incoming message text and sender data are never shown here.
          </p>
        </div>
        <button
          className={`${secondaryButtonClass} w-full sm:w-auto`}
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
        >
          <RefreshCcw className={refreshing ? "animate-spin" : ""} size={13} />
          Refresh
        </button>
      </div>

      {error ? <p className="mb-0 mt-3 text-xs text-wago-danger">{error}</p> : null}

      <div className="mt-3 overflow-x-auto border-y border-wago-line">
        {loading ? (
          <p className="m-0 px-3 py-3 text-xs text-wago-muted">Loading delivery activity…</p>
        ) : deliveries.length === 0 ? (
          <p className="m-0 px-3 py-3 text-xs text-wago-muted">No retained webhook deliveries yet.</p>
        ) : (
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="text-[10px] uppercase tracking-[0.08em] text-wago-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Event</th>
                <th className="px-3 py-2 font-medium">Attempts</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium">
                  <span className="sr-only">Inspect</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((delivery) => {
                const expanded = selected?.id === delivery.id;
                return (
                  <Fragment key={delivery.id}>
                    <tr className="border-t border-wago-line">
                      <td className={`px-3 py-2 font-medium ${statusClass(delivery.status)}`}>{delivery.status}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-wago-ink">{delivery.event}</td>
                      <td className="px-3 py-2 text-wago-muted">{delivery.attemptCount}</td>
                      <td className="px-3 py-2 text-wago-muted">{formatTimestamp(delivery.createdAt)}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-wago-muted hover:bg-wago-hover hover:text-wago-ink"
                          type="button"
                          onClick={() => void inspect(delivery.id)}
                          aria-label={expanded ? "Collapse delivery details" : "Inspect delivery"}
                          aria-expanded={expanded}
                        >
                          <ChevronRight className={expanded ? "rotate-90" : ""} size={14} />
                        </button>
                      </td>
                    </tr>
                    {expanded && selected ? (
                      <tr className="border-t border-wago-line bg-wago-surface-subtle">
                        <td colSpan={5} className="px-3 py-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <code className="block break-all font-mono text-[10px] text-wago-tertiary">
                                {selected.id}
                              </code>
                              {!selected.redeliveryAvailable ? (
                                <p className="mb-0 mt-1 text-xs leading-5 text-wago-muted">
                                  Terminal incoming payload was removed; diagnostic evidence remains, but manual
                                  redelivery is unavailable.
                                </p>
                              ) : null}
                            </div>
                            {selected.redeliveryAvailable ? (
                              <button
                                className={`${secondaryButtonClass} w-full sm:w-auto`}
                                type="button"
                                onClick={() => void redeliver()}
                                disabled={redelivering || selected.status === "delivering"}
                              >
                                <RotateCcw size={13} />
                                {redelivering ? "Redelivering" : "Redeliver"}
                              </button>
                            ) : null}
                          </div>

                          <div className="mt-3 border-t border-wago-line pt-3">
                            <div className="text-[11px] font-semibold text-wago-secondary">Attempt history</div>
                            {selected.attempts.length === 0 ? (
                              <p className="mb-0 mt-2 text-xs text-wago-muted">No attempt has started yet.</p>
                            ) : (
                              <ol className="mb-0 mt-2 grid list-none gap-2 p-0">
                                {selected.attempts.map((attempt) => (
                                  <li
                                    className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"
                                    key={attempt.sequence}
                                  >
                                    <code className="font-mono text-[10px] text-wago-tertiary">
                                      #{attempt.sequence}
                                    </code>
                                    <span className="font-medium text-wago-ink">{attemptLabel(attempt)}</span>
                                    {attempt.statusCode ? (
                                      <span className="text-wago-muted">HTTP {attempt.statusCode}</span>
                                    ) : null}
                                    {attempt.errorCode ? (
                                      <code className="font-mono text-[10px] text-wago-tertiary">
                                        {attempt.errorCode}
                                      </code>
                                    ) : null}
                                    <span className="text-[10px] text-wago-tertiary">
                                      {formatTimestamp(attempt.startedAt)}
                                    </span>
                                  </li>
                                ))}
                              </ol>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
