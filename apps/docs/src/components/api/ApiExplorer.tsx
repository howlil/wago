import React, { useMemo, useState } from "react";
import { apiEndpoints, getEndpointById, requiresLiveConfirmation } from "./endpoint-catalog";
import { buildLiveRequest, buildSnippet, type ExplorerValues, type SnippetLanguage } from "./request-builder";
import { formatExplorerResponse } from "./response-format";
import type { ApiEndpoint, ApiLanguage } from "./types";

type ExplorerResponse = {
  status?: number;
  ok?: boolean;
  elapsedMs?: number;
  contentType?: string;
  body: string;
  networkError?: boolean;
};

const snippetTabs: Array<{ id: SnippetLanguage; label: string }> = [
  { id: "curl", label: "cURL" },
  { id: "javascript", label: "JavaScript" },
  { id: "python", label: "Python" },
  { id: "nodejs", label: "Node.js" },
];

const groupLabels: Record<ApiEndpoint["group"], Record<ApiLanguage, string>> = {
  system: { en: "System", id: "Sistem" },
  app: { en: "Application", id: "Aplikasi" },
  whatsapp: { en: "WhatsApp", id: "WhatsApp" },
  recipients: { en: "Recipients", id: "Recipient" },
  messages: { en: "Messages", id: "Pesan" },
  audit: { en: "Audit", id: "Audit" },
};

const fieldClass =
  "w-full rounded-md border border-[var(--docs-line-strong)] bg-[var(--docs-code)] px-3 py-2.5 text-sm text-[var(--docs-text-soft)] outline-none focus:border-[var(--docs-accent)]";
const primaryActionClass =
  "rounded-md bg-[var(--docs-text)] px-3.5 py-2 text-xs font-semibold text-[var(--docs-bg)] hover:bg-[var(--docs-text-soft)] disabled:cursor-not-allowed disabled:opacity-50";
const secondaryActionClass =
  "rounded-md border border-[var(--docs-line-strong)] px-3.5 py-2 text-xs font-medium text-[var(--docs-muted)] hover:text-[var(--docs-text)]";

function initialValues(endpoint: ApiEndpoint): ExplorerValues {
  return Object.fromEntries(endpoint.fields.map((field) => [field.key, field.defaultValue ?? ""]));
}

function authLabel(endpoint: ApiEndpoint, lang: ApiLanguage): string {
  if (endpoint.auth === "public") {
    return lang === "id" ? "Publik" : "Public";
  }
  if (endpoint.auth === "first-run") {
    return "First run";
  }
  return "Bearer API key";
}

export function ApiExplorer({ lang = "en" }: { lang?: ApiLanguage }) {
  const [baseUrl, setBaseUrl] = useState("http://localhost:3000");
  const [apiKey, setApiKey] = useState("");
  const [endpointId, setEndpointId] = useState(apiEndpoints[0].id);
  const [values, setValues] = useState<ExplorerValues>(() => initialValues(apiEndpoints[0]));
  const [snippetLanguage, setSnippetLanguage] = useState<SnippetLanguage>("curl");
  const [copied, setCopied] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<ExplorerResponse | null>(null);

  const endpoint = getEndpointById(endpointId) ?? apiEndpoints[0];
  const snippet = useMemo(
    () =>
      buildSnippet({
        endpoint,
        baseUrl,
        values,
        language: snippetLanguage,
      }),
    [endpoint, baseUrl, values, snippetLanguage],
  );

  const copy = {
    baseUrl: lang === "id" ? "Base URL Wago" : "Wago Base URL",
    apiKey: "API key",
    endpoint: "Endpoint",
    request: lang === "id" ? "Request" : "Request",
    snippet: lang === "id" ? "Generated snippet" : "Generated snippet",
    response: "Response",
    send: lang === "id" ? "Kirim request" : "Send request",
    sending: lang === "id" ? "Mengirim..." : "Sending...",
    clear: lang === "id" ? "Bersihkan" : "Clear",
    copy: lang === "id" ? "Salin" : "Copy",
    copied: lang === "id" ? "Tersalin" : "Copied",
    confirm: lang === "id" ? "Konfirmasi dan kirim" : "Confirm and send",
    cancel: lang === "id" ? "Batal" : "Cancel",
    optional: lang === "id" ? "opsional" : "optional",
    required: lang === "id" ? "wajib" : "required",
  };

  function selectEndpoint(nextId: string) {
    const next = getEndpointById(nextId);
    if (!next) return;
    setEndpointId(nextId);
    setValues(initialValues(next));
    setConfirmationOpen(false);
    setResponse(null);
  }

  function setField(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function copySnippet() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function validateLiveRequest(): string | null {
    if (!baseUrl.trim()) return lang === "id" ? "Base URL wajib diisi." : "Base URL is required.";
    if (endpoint.auth === "api-key" && !apiKey.trim()) {
      return lang === "id" ? "API key wajib untuk endpoint ini." : "An API key is required for this endpoint.";
    }
    const missing = endpoint.fields.find((field) => field.required && !values[field.key]?.trim());
    if (missing) return lang === "id" ? `${missing.label.id} wajib diisi.` : `${missing.label.en} is required.`;
    return null;
  }

  async function executeRequest() {
    const validationError = validateLiveRequest();
    if (validationError) {
      setResponse({ body: validationError, networkError: true });
      setConfirmationOpen(false);
      return;
    }

    setSending(true);
    setConfirmationOpen(false);
    setResponse(null);
    const startedAt = performance.now();

    try {
      const request = buildLiveRequest({ endpoint, baseUrl, apiKey, values });
      const result = await fetch(request.url, {
        ...request.init,
        credentials: endpoint.auth === "first-run" ? "include" : "omit",
      });
      const formatted = await formatExplorerResponse(result);
      setResponse({
        status: result.status,
        ok: result.ok,
        elapsedMs: Math.round(performance.now() - startedAt),
        contentType: formatted.contentType || "unknown",
        body: formatted.body,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setResponse({
        networkError: true,
        elapsedMs: Math.round(performance.now() - startedAt),
        body:
          lang === "id"
            ? `Request browser gagal: ${message}\n\nExplorer mengirim request langsung ke Base URL Wago. Jika docs dan Wago berada di origin berbeda, browser dapat memblokir request karena same-origin/CORS policy. Wago core tidak menambahkan cross-origin response headers; gunakan same-origin routing/reverse proxy yang sengaja dikonfigurasi, atau gunakan generated snippet dari backend Anda.`
            : `Browser request failed: ${message}\n\nThe explorer sends requests directly to the Wago Base URL. If the docs and Wago use different origins, the browser may block the request under same-origin/CORS policy. Wago core does not add cross-origin response headers; use intentionally configured same-origin routing/reverse proxying, or use the generated snippet from your backend.`,
      });
    } finally {
      setSending(false);
    }
  }

  function requestLive() {
    if (requiresLiveConfirmation(endpoint)) {
      setConfirmationOpen(true);
      return;
    }
    void executeRequest();
  }

  return (
    <section className="my-8 overflow-hidden rounded-md border border-[var(--docs-line)] bg-[var(--docs-surface)]" aria-labelledby="api-explorer-title">
      <header className="border-b border-[var(--docs-line)] px-4 py-4 sm:px-5">
        <h2 id="api-explorer-title" className="m-0 text-[15px] font-semibold text-[var(--docs-text)]">
          API Explorer
        </h2>
        <p className="mb-0 mt-1 max-w-3xl text-[13px] leading-6 text-[var(--docs-muted)]">
          {lang === "id"
            ? "Bangun request dan, bila perlu, jalankan langsung dari browser. API key asli hanya berada di memory halaman ini dan tidak dimasukkan ke generated snippet."
            : "Build a request and, when useful, run it directly from the browser. Your real API key stays in this page's memory and is never inserted into generated snippets."}
        </p>
      </header>

      <div className="grid xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:divide-x xl:divide-[var(--docs-line)]">
        <div className="min-w-0 px-4 py-5 sm:px-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[var(--docs-text-soft)]">{copy.baseUrl}</span>
              <input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                spellCheck={false}
                className={`${fieldClass} font-mono`}
                placeholder="https://wago.example.com"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[var(--docs-text-soft)]">{copy.apiKey}</span>
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                autoComplete="off"
                className={`${fieldClass} font-mono`}
                placeholder="wa_..."
              />
            </label>
          </div>

          <div className="mt-5 border-y border-[var(--docs-line)] py-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[var(--docs-text-soft)]">{copy.endpoint}</span>
              <select value={endpoint.id} onChange={(event) => selectEndpoint(event.target.value)} className={fieldClass}>
                {Object.entries(groupLabels).map(([group, labels]) => (
                  <optgroup key={group} label={labels[lang]}>
                    {apiEndpoints
                      .filter((item) => item.group === group)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.method} {item.path} — {item.title[lang]}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <div className="mt-4 grid gap-1 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-baseline sm:gap-x-3">
              <span className="font-mono text-xs font-semibold text-[var(--docs-accent-strong)]">{endpoint.method}</span>
              <code className="break-all text-sm text-[var(--docs-text)]">{endpoint.path}</code>
              <span className="text-[11px] text-[var(--docs-tertiary)]">{authLabel(endpoint, lang)}</span>
              <p className="mb-0 mt-2 text-[13px] leading-6 text-[var(--docs-muted)] sm:col-span-3">{endpoint.description[lang]}</p>
            </div>
          </div>

          {endpoint.fields.length > 0 ? (
            <section className="py-5" aria-labelledby="api-explorer-request-title">
              <h3 id="api-explorer-request-title" className="m-0 text-xs font-semibold text-[var(--docs-text)]">
                {copy.request}
              </h3>
              <div className="mt-3 space-y-4">
                {endpoint.fields.map((field) => (
                  <label key={`${field.location}-${field.key}`} className="block">
                    <span className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs font-medium text-[var(--docs-text-soft)]">
                      {field.label[lang]}
                      <span className="font-mono text-[10px] font-normal text-[var(--docs-tertiary)]">{field.location}</span>
                      <span className="text-[10px] font-normal text-[var(--docs-tertiary)]">
                        {field.required ? copy.required : copy.optional}
                      </span>
                    </span>
                    {field.input === "select" ? (
                      <select
                        value={values[field.key] ?? ""}
                        onChange={(event) => setField(field.key, event.target.value)}
                        className={fieldClass}
                      >
                        {(field.options ?? []).map((option) => (
                          <option key={option || "__empty"} value={option}>
                            {option || (lang === "id" ? "Semua / kosong" : "All / empty")}
                          </option>
                        ))}
                      </select>
                    ) : field.input === "textarea" ? (
                      <textarea
                        value={values[field.key] ?? ""}
                        onChange={(event) => setField(field.key, event.target.value)}
                        rows={4}
                        className={`${fieldClass} resize-y`}
                        placeholder={field.placeholder}
                      />
                    ) : (
                      <input
                        value={values[field.key] ?? ""}
                        onChange={(event) => setField(field.key, event.target.value)}
                        className={`${fieldClass} font-mono`}
                        placeholder={field.placeholder}
                      />
                    )}
                    <span className="mt-1.5 block text-xs leading-5 text-[var(--docs-tertiary)]">{field.description[lang]}</span>
                  </label>
                ))}
              </div>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-[var(--docs-line)] pt-4">
            <button type="button" onClick={requestLive} disabled={sending} className={primaryActionClass}>
              {sending ? copy.sending : copy.send}
            </button>
            {response ? (
              <button type="button" onClick={() => setResponse(null)} className={secondaryActionClass}>
                {copy.clear}
              </button>
            ) : null}
          </div>

          {confirmationOpen ? (
            <aside
              className={`mt-4 rounded-md border p-4 ${
                endpoint.danger === "high"
                  ? "border-[var(--docs-danger)] bg-[var(--docs-danger-soft)]"
                  : "border-[var(--docs-warning)] bg-[var(--docs-warning-soft)]"
              }`}
            >
              <p className="m-0 text-sm font-semibold text-[var(--docs-text)]">
                {endpoint.danger === "high"
                  ? lang === "id"
                    ? "Tindakan ini mengganti session WhatsApp saat ini"
                    : "This replaces the current WhatsApp session"
                  : lang === "id"
                    ? "Konfirmasi perubahan state"
                    : "Confirm state-changing request"}
              </p>
              <p className="mb-0 mt-1.5 text-xs leading-5 text-[var(--docs-muted)]">
                {endpoint.danger === "high"
                  ? lang === "id"
                    ? "Rebind akan menghapus auth/binding lama dan memulai pairing akun baru. Gunakan hanya jika memang ingin mengganti akun atau memulihkan session."
                    : "Rebind clears the previous auth/binding and starts pairing a replacement account. Use it only when intentionally changing accounts or recovering the session."
                  : lang === "id"
                    ? "Endpoint POST dapat mengubah state gateway atau mengirim pesan. Periksa Base URL dan input sebelum melanjutkan."
                    : "POST endpoints can change gateway state or send a message. Verify the Base URL and request values before continuing."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void executeRequest()} className={primaryActionClass}>
                  {copy.confirm}
                </button>
                <button type="button" onClick={() => setConfirmationOpen(false)} className={secondaryActionClass}>
                  {copy.cancel}
                </button>
              </div>
            </aside>
          ) : null}
        </div>

        <div className="min-w-0 border-t border-[var(--docs-line)] xl:border-t-0">
          <section aria-labelledby="api-explorer-snippet-title">
            <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-[var(--docs-line)] px-4 sm:px-5">
              <h3 id="api-explorer-snippet-title" className="m-0 text-xs font-semibold text-[var(--docs-text)]">
                {copy.snippet}
              </h3>
              <button type="button" onClick={() => void copySnippet()} className="py-2 text-xs font-medium text-[var(--docs-muted)] hover:text-[var(--docs-text)]">
                {copied ? copy.copied : copy.copy}
              </button>
            </div>
            <div className="flex min-w-0 overflow-x-auto border-b border-[var(--docs-line)] px-2">
              {snippetTabs.map((tab) => (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setSnippetLanguage(tab.id)}
                  className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-xs ${
                    snippetLanguage === tab.id
                      ? "border-[var(--docs-accent)] text-[var(--docs-text)]"
                      : "border-transparent text-[var(--docs-tertiary)] hover:text-[var(--docs-muted)]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <pre className="m-0 max-h-[430px] overflow-auto bg-[var(--docs-code)] p-4 text-xs leading-6 text-[var(--docs-text-soft)] sm:p-5">
              <code>{snippet}</code>
            </pre>
          </section>

          <section className="border-t border-[var(--docs-line)]" aria-labelledby="api-explorer-response-title">
            <div className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--docs-line)] px-4 py-2 sm:px-5">
              <h3 id="api-explorer-response-title" className="m-0 text-xs font-semibold text-[var(--docs-text)]">
                {copy.response}
              </h3>
              {response?.status !== undefined ? (
                <span className={`font-mono text-[11px] font-semibold ${response.ok ? "text-[var(--docs-accent-strong)]" : "text-[var(--docs-danger)]"}`}>
                  HTTP {response.status}
                </span>
              ) : null}
              {response?.elapsedMs !== undefined ? <span className="text-[11px] text-[var(--docs-tertiary)]">{response.elapsedMs} ms</span> : null}
              {response?.contentType ? <span className="text-[11px] text-[var(--docs-tertiary)]">{response.contentType}</span> : null}
            </div>
            <pre className="m-0 min-h-40 max-h-[430px] overflow-auto whitespace-pre-wrap break-words bg-[var(--docs-code)] p-4 text-xs leading-6 text-[var(--docs-text-soft)] sm:p-5">
              <code>
                {response?.body ??
                  (lang === "id"
                    ? "Response live akan muncul di sini. Tidak ada request yang dikirim sampai Anda menekan tombol Kirim request."
                    : "Live response appears here. No request is sent until you click Send request.")}
              </code>
            </pre>
          </section>

          <p className="m-0 border-t border-[var(--docs-line)] px-4 py-3 text-xs leading-5 text-[var(--docs-tertiary)] sm:px-5">
            {lang === "id"
              ? "Live mode berjalan langsung dari browser ke Base URL Wago yang Anda isi. Dokumentasi ini tidak memiliki proxy, tidak menyimpan history request, dan tidak dapat melewati same-origin/CORS policy browser."
              : "Live mode runs directly from your browser to the Wago Base URL you enter. This documentation has no proxy, stores no request history, and cannot bypass browser same-origin/CORS policy."}
          </p>
        </div>
      </div>
    </section>
  );
}
