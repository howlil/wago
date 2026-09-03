import { Check, Copy, RefreshCcw, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useClipboard } from "../../shared/hooks/useClipboard.js";
import {
  fieldLabelClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  sectionDescriptionClass,
  sectionTitleClass,
  workspaceModuleClass,
  workspaceModuleHeaderClass,
} from "../../shared/ui/classes.js";
import {
  completeWebhookSecretRotation,
  getWebhookSettings,
  rotateWebhookSecret,
  sendWebhookTest,
  updateWebhookSettings,
  type WebhookTestDelivery,
} from "./api.js";
import { WebhookDeliveryDiagnostics } from "./WebhookDeliveryDiagnostics.js";

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Webhook settings could not be updated.";
}

function testResultMessage(delivery: WebhookTestDelivery): string {
  if (delivery.status === "delivered") {
    return `Test webhook delivered${delivery.lastStatusCode ? ` (HTTP ${delivery.lastStatusCode})` : ""}.`;
  }
  if (delivery.status === "failed") {
    return `Test webhook failed${delivery.lastStatusCode ? ` (HTTP ${delivery.lastStatusCode})` : ""}.`;
  }
  if (delivery.status === "expired") return "Test webhook expired before delivery.";
  if (delivery.status === "pending" && delivery.lastStatusCode) {
    return `Test webhook queued for retry after HTTP ${delivery.lastStatusCode}.`;
  }
  if (delivery.status === "delivering") return "Test webhook is being delivered.";
  return "Test webhook queued.";
}

const supportedEvents = [
  ["Incoming messages", "message.received"],
  ["Message accepted", "message.server_accepted"],
  ["Message rejected", "message.rejected"],
] as const;

export function WebhookSettingsCard() {
  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState("");
  const [savedEnabled, setSavedEnabled] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [secretConfigured, setSecretConfigured] = useState(false);
  const [rotationPending, setRotationPending] = useState(false);
  const [generatedSecret, setGeneratedSecret] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [error, setError] = useState("");
  const { copiedField, copy } = useClipboard<"webhookSecret">({ onError: setError });

  useEffect(() => {
    let active = true;
    void getWebhookSettings()
      .then((settings) => {
        if (!active) return;
        setEnabled(settings.enabled);
        setUrl(settings.url ?? "");
        setSavedEnabled(settings.enabled);
        setSavedUrl(settings.url);
        setSecretConfigured(settings.secretConfigured);
        setRotationPending(settings.rotationPending);
        setUpdatedAt(settings.updatedAt);
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

  async function save(): Promise<void> {
    setSaving(true);
    setError("");
    setTestResult("");
    try {
      const settings = await updateWebhookSettings({ enabled, url: url.trim() || null });
      setEnabled(settings.enabled);
      setUrl(settings.url ?? "");
      setSavedEnabled(settings.enabled);
      setSavedUrl(settings.url);
      setSecretConfigured(settings.secretConfigured);
      setRotationPending(settings.rotationPending);
      setUpdatedAt(settings.updatedAt);
      if (settings.generatedSecret) setGeneratedSecret(settings.generatedSecret);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function testWebhook(): Promise<void> {
    setTesting(true);
    setError("");
    setTestResult("");
    try {
      const result = await sendWebhookTest();
      setTestResult(testResultMessage(result.delivery));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setTesting(false);
    }
  }

  async function rotate(): Promise<void> {
    setSaving(true);
    setError("");
    setTestResult("");
    try {
      const settings = await rotateWebhookSecret();
      setSecretConfigured(settings.secretConfigured);
      setRotationPending(settings.rotationPending);
      setUpdatedAt(settings.updatedAt);
      setGeneratedSecret(settings.generatedSecret ?? "");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function completeRotation(): Promise<void> {
    setSaving(true);
    setError("");
    setTestResult("");
    try {
      const settings = await completeWebhookSecretRotation();
      setRotationPending(settings.rotationPending);
      setUpdatedAt(settings.updatedAt);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  const normalizedUrl = url.trim() || null;
  const canTest =
    savedEnabled && Boolean(savedUrl) && secretConfigured && enabled === savedEnabled && normalizedUrl === savedUrl;

  return (
    <section className={workspaceModuleClass} aria-labelledby="webhooks-title">
      <div className={workspaceModuleHeaderClass}>
        <div className="min-w-0">
          <h2 id="webhooks-title" className={sectionTitleClass}>
            Webhooks
          </h2>
          <p className={sectionDescriptionClass}>Send signed gateway events to another backend.</p>
        </div>
        <span className={`shrink-0 text-xs font-medium ${enabled ? "text-wago-positive" : "text-wago-muted"}`}>
          {enabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      {error ? (
        <div className="mt-4 rounded-md border border-wago-danger/30 bg-wago-danger-soft px-3 py-2 text-xs text-wago-danger">
          {error}
        </div>
      ) : null}

      {testResult ? (
        <div className="mt-4 rounded-md border border-wago-line bg-wago-surface-subtle px-3 py-2 text-xs text-wago-ink">
          {testResult}
        </div>
      ) : null}

      <section className="border-b border-wago-line py-4" aria-labelledby="webhook-configuration-title">
        <h3 id="webhook-configuration-title" className="m-0 text-xs font-semibold text-wago-ink">
          Configuration
        </h3>

        <div className="mt-3 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] xl:gap-x-6 xl:gap-y-4">
          <div className="grid content-start gap-4">
            <label className="flex items-start gap-3">
              <input
                className="mt-0.5 h-4 w-4 shrink-0 accent-wago-brand"
                type="checkbox"
                aria-label="Enable webhook delivery"
                checked={enabled}
                onChange={(event) => {
                  setEnabled(event.target.checked);
                  setTestResult("");
                }}
                disabled={loading || saving || testing}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-wago-ink">Enable webhook delivery</span>
                <span className="mt-0.5 block max-w-prose text-xs leading-5 text-wago-muted">
                  Retry transient callback failures automatically.
                </span>
              </span>
            </label>

            <label>
              <span className={fieldLabelClass}>Callback URL</span>
              <input
                className={inputClass}
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value);
                  setTestResult("");
                }}
                placeholder="https://your-backend.example.com/webhooks/wago"
                inputMode="url"
                autoComplete="url"
                disabled={loading || saving || testing}
              />
              <span className="mt-1 block max-w-prose text-xs leading-5 text-wago-muted">
                Use an HTTPS endpoint owned by the receiving backend in production.
              </span>
            </label>
          </div>

          <div className="grid content-start gap-4 border-t border-wago-line pt-4 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
            <div className="border-b border-wago-line pb-4">
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-wago-ink">Signing</div>
                  <p className="mb-0 mt-0.5 max-w-prose text-xs leading-5 text-wago-muted">
                    {secretConfigured ? "Signing secret configured." : "A signing secret is created on first enable."}
                  </p>
                </div>
                {secretConfigured ? (
                  <button
                    className={`${secondaryButtonClass} w-full shrink-0 sm:w-auto`}
                    type="button"
                    onClick={() => void rotate()}
                    disabled={saving || testing}
                  >
                    <RefreshCcw size={14} />
                    Rotate secret
                  </button>
                ) : null}
              </div>

              {rotationPending ? (
                <div className="mt-3 flex flex-col items-start gap-3 border-t border-wago-line pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="m-0 min-w-0 text-xs leading-5 text-wago-muted">
                    Rotation overlap is active. Update the receiver before completing rotation.
                  </p>
                  <button
                    className={`${secondaryButtonClass} w-full shrink-0 sm:w-auto`}
                    type="button"
                    onClick={() => void completeRotation()}
                    disabled={saving || testing}
                  >
                    Complete rotation
                  </button>
                </div>
              ) : null}
            </div>

            <details>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold text-wago-ink [&::-webkit-details-marker]:hidden">
                <span>Supported events</span>
                <span className="font-normal text-wago-muted">3 events</span>
              </summary>
              <div className="mt-3 divide-y divide-wago-line border-t border-wago-line">
                {supportedEvents.map(([label, event]) => (
                  <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:justify-between" key={event}>
                    <span className="text-xs text-wago-ink">{label}</span>
                    <code className="font-mono text-[10px] text-wago-tertiary">{event}</code>
                  </div>
                ))}
              </div>
              <p className="mb-0 mt-2 text-xs leading-5 text-wago-muted">
                Incoming sender and text data are retained only while an active retry needs them and are removed when the
                delivery becomes terminal.
              </p>
            </details>
          </div>

          {generatedSecret ? (
            <div className="rounded-md border border-wago-line bg-wago-surface-subtle p-3 xl:col-span-2">
              <strong className="block text-xs font-semibold text-wago-ink">New signing secret</strong>
              <p className="mb-2 mt-0.5 max-w-prose text-xs leading-5 text-wago-muted">
                Copy this now. The raw secret is only returned by this create or rotate response.
              </p>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input className={`${inputClass} min-w-0 font-mono text-xs`} value={generatedSecret} readOnly />
                <button
                  className={`${secondaryButtonClass} w-full sm:w-auto`}
                  type="button"
                  onClick={() => void copy(generatedSecret, "webhookSecret")}
                >
                  {copiedField === "webhookSecret" ? <Check size={14} /> : <Copy size={14} />}
                  {copiedField === "webhookSecret" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-wago-line pt-3 sm:flex-row sm:items-center sm:justify-between xl:col-span-2">
            <span className="text-[10px] text-wago-tertiary">
              {updatedAt ? `Last updated ${new Date(updatedAt).toLocaleString()}` : "No saved webhook configuration."}
            </span>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <button
                className={`${secondaryButtonClass} w-full sm:w-auto`}
                type="button"
                onClick={() => void testWebhook()}
                disabled={loading || saving || testing || !canTest}
                title={canTest ? undefined : "Save an enabled webhook configuration before testing"}
              >
                <Send size={14} />
                {testing ? "Sending test" : "Send test webhook"}
              </button>
              <button
                className={`${primaryButtonClass} w-full sm:w-auto`}
                type="button"
                onClick={() => void save()}
                disabled={loading || saving || testing}
              >
                {saving ? "Saving" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <WebhookDeliveryDiagnostics />
    </section>
  );
}
