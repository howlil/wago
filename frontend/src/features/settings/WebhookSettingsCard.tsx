import { Check, Copy, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import {
  completeWebhookSecretRotation,
  getWebhookSettings,
  rotateWebhookSecret,
  updateWebhookSettings,
} from "../../api.js";
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

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Webhook settings could not be updated.";
}

export function WebhookSettingsCard() {
  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState("");
  const [secretConfigured, setSecretConfigured] = useState(false);
  const [rotationPending, setRotationPending] = useState(false);
  const [generatedSecret, setGeneratedSecret] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { copiedField, copy } = useClipboard<"webhookSecret">({ onError: setError });

  useEffect(() => {
    let active = true;
    void getWebhookSettings()
      .then((settings) => {
        if (!active) return;
        setEnabled(settings.enabled);
        setUrl(settings.url ?? "");
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
    try {
      const settings = await updateWebhookSettings({ enabled, url: url.trim() || null });
      setEnabled(settings.enabled);
      setUrl(settings.url ?? "");
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

  async function rotate(): Promise<void> {
    setSaving(true);
    setError("");
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

  return (
    <section className={cardBodyClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={sectionTitleClass}>Webhook integration</h2>
          <p className={sectionDescriptionClass}>
            Send signed message-delivery events to another backend. Configuration is persisted by Wago.
          </p>
        </div>
        <span className={`text-xs font-medium ${enabled ? "text-wago-brand" : "text-wago-muted"}`}>
          {enabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-[#e4b8bc] bg-wago-danger-soft px-3 py-2 text-xs text-wago-danger">
          {error}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4">
        <label className="flex items-start gap-3">
          <input
            className="mt-0.5 h-4 w-4 accent-wago-brand"
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            disabled={loading || saving}
          />
          <span>
            <span className="block text-sm font-medium text-wago-ink">Enable webhook delivery</span>
            <span className="mt-0.5 block text-xs leading-5 text-wago-muted">
              Wago will enqueue supported delivery events and retry transient failures automatically.
            </span>
          </span>
        </label>

        <label>
          <span className={fieldLabelClass}>Callback URL</span>
          <input
            className={inputClass}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://your-backend.example.com/webhooks/wago"
            inputMode="url"
            autoComplete="url"
            disabled={loading || saving}
          />
          <span className="mt-1 block text-[10px] leading-4 text-wago-muted">
            Use an HTTPS endpoint owned by the receiving backend in production.
          </span>
        </label>

        <div className="border-y border-wago-line py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-wago-ink">Signing secret</div>
              <div className="mt-0.5 text-[11px] text-wago-muted">
                {secretConfigured ? "Configured. Raw value is not returned by settings reads." : "Created automatically on first enable."}
              </div>
            </div>
            {secretConfigured ? (
              <button className={secondaryButtonClass} type="button" onClick={() => void rotate()} disabled={saving}>
                <RefreshCcw size={14} />
                Rotate secret
              </button>
            ) : null}
          </div>

          {rotationPending ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-wago-line pt-3">
              <p className="m-0 text-[11px] leading-5 text-wago-muted">
                Rotation overlap is active. Update the receiver with the new secret before completing rotation.
              </p>
              <button
                className={secondaryButtonClass}
                type="button"
                onClick={() => void completeRotation()}
                disabled={saving}
              >
                Complete rotation
              </button>
            </div>
          ) : null}
        </div>

        {generatedSecret ? (
          <div className="rounded-lg border border-[#c9ddd3] bg-wago-brand-soft p-3">
            <strong className="block text-xs font-semibold text-wago-brand-strong">Copy the new signing secret now</strong>
            <p className="mb-2 mt-1 text-[11px] leading-5 text-[#53675e]">
              This value is shown only from the create/rotate response. Store it in the receiving backend.
            </p>
            <div className="flex gap-2">
              <input className={`${inputClass} min-w-0 flex-1 font-mono text-xs`} value={generatedSecret} readOnly />
              <button
                className={secondaryButtonClass}
                type="button"
                onClick={() => void copy(generatedSecret, "webhookSecret")}
              >
                {copiedField === "webhookSecret" ? <Check size={14} /> : <Copy size={14} />}
                {copiedField === "webhookSecret" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[10px] text-wago-muted">
            {updatedAt ? `Last updated ${new Date(updatedAt).toLocaleString()}` : "No persisted webhook configuration yet."}
          </span>
          <button className={primaryButtonClass} type="button" onClick={() => void save()} disabled={loading || saving}>
            {saving ? "Saving" : "Save changes"}
          </button>
        </div>
      </div>
    </section>
  );
}
