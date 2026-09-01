import { Check, Copy, RefreshCcw, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useClipboard } from "../../shared/hooks/useClipboard.js";
import {
  cardBodyClass,
  fieldLabelClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  sectionDescriptionClass,
  sectionTitleClass,
} from "../../shared/ui/classes.js";
import {
  completeWebhookSecretRotation,
  getWebhookSettings,
  rotateWebhookSecret,
  sendWebhookTest,
  updateWebhookSettings,
  type WebhookTestDelivery,
} from "./api.js";

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
  if (delivery.status === "expired") {
    return "Test webhook expired before delivery.";
  }
  if (delivery.status === "pending" && delivery.lastStatusCode) {
    return `Test webhook queued for retry after HTTP ${delivery.lastStatusCode}.`;
  }
  if (delivery.status === "delivering") {
    return "Test webhook is being delivered.";
  }
  return "Test webhook queued.";
}

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
      if (settings.generatedSecret) {
        setGeneratedSecret(settings.generatedSecret);
      }
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
    <section className={cardBodyClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={sectionTitleClass}>Webhook integration</h2>
          <p className={sectionDescriptionClass}>
            Send signed incoming-message and outbound-delivery events to another backend. Configuration is persisted by Wago.
          </p>
        </div>
        <span className={`shrink-0 text-xs font-medium ${enabled ? "text-wago-brand" : "text-wago-muted"}`}>
          {enabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      {error ? (
        <div className="mt-4 rounded-md border border-[#e4b8bc] bg-wago-danger-soft px-3 py-2 text-xs text-wago-danger">
          {error}
        </div>
      ) : null}

      {testResult ? (
        <div className="mt-4 rounded-md border border-wago-line bg-wago-surface-soft px-3 py-2 text-xs text-wago-ink">
          {testResult}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4">
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
            <span className="mt-0.5 block text-xs leading-5 text-wago-muted">
              Wago will enqueue supported message and delivery events and retry transient failures automatically.
            </span>
          </span>
        </label>

        <div className="rounded-md border border-wago-line bg-wago-surface-soft px-3 py-2 text-[11px] leading-5 text-wago-muted">
          Events: <span className="font-mono text-wago-ink">message.received</span>,{" "}
          <span className="font-mono text-wago-ink">message.server_accepted</span>, and{" "}
          <span className="font-mono text-wago-ink">message.rejected</span>. Incoming text/sender data is retained only while active retry delivery needs it and is removed when that delivery becomes terminal.
        </div>

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
          <span className="mt-1 block text-[10px] leading-4 text-wago-muted">
            Use an HTTPS endpoint owned by the receiving backend in production.
          </span>
        </label>

        <div className="border-y border-wago-line py-3">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-medium text-wago-ink">Signing secret</div>
              <div className="mt-0.5 text-[11px] leading-5 text-wago-muted">
                {secretConfigured
                  ? "Configured. Raw value is not returned by settings reads."
                  : "Created automatically on first enable."}
              </div>
            </div>
            {secretConfigured ? (
              <button
                className={`${secondaryButtonClass} w-full sm:w-auto`}
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
              <p className="m-0 min-w-0 text-[11px] leading-5 text-wago-muted">
                Rotation overlap is active. Update the receiver with the new secret before completing rotation.
              </p>
              <button
                className={`${secondaryButtonClass} w-full sm:w-auto`}
                type="button"
                onClick={() => void completeRotation()}
                disabled={saving || testing}
              >
                Complete rotation
              </button>
            </div>
          ) : null}
        </div>

        {generatedSecret ? (
          <div className="rounded-md border border-[#c9ddd3] bg-wago-brand-soft p-3">
            <strong className="block text-xs font-semibold text-wago-brand-strong">
              Copy the new signing secret now
            </strong>
            <p className="mb-2 mt-1 text-[11px] leading-5 text-[#53675e]">
              This value is shown only from the create/rotate response. Store it in the receiving backend.
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

        <div className="flex flex-col gap-3 border-t border-wago-line pt-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[10px] leading-4 text-wago-muted">
            {updatedAt
              ? `Last updated ${new Date(updatedAt).toLocaleString()}`
              : "No persisted webhook configuration yet."}
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
  );
}
