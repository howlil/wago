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
    <div className="my-8 overflow-hidden rounded-xl border border-[#262626] bg-[#0d0d0d]">
      <div className="border-b border-[#262626] px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#71717a]">API Explorer</p>
            <h2 className="mt-1 text-lg font-semibold text-[#fafafa]">
              {lang === "id" ? "Bangun request, lalu coba secara opsional" : "Build a request, then optionally try it live"}
            </h2>
          </div>
          <span className="mt-2 inline-flex w-fit rounded-full border border-[#262626] px-2.5 py-1 text-xs text-[#a1a1aa] sm:mt-0">
            {lang === "id" ? "Secret hanya di memory browser" : "Secrets stay in browser memory"}
          </span>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#71717a]">
          {lang === "id"
            ? "Generated snippet selalu memakai YOUR_API_KEY. API key asli hanya dipakai untuk Authorization header ketika Anda menekan Kirim request dan tidak disimpan oleh halaman ini."
            : "Generated snippets always use YOUR_API_KEY. Your real key is only used in the Authorization header when you send a live request and is not persisted by this page."}
        </p>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">{copy.baseUrl}</span>
              <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} spellCheck={false} className="w-full rounded-lg border border-[#2a2a2a] bg-[#111] px-3 py-2.5 font-mono text-sm text-[#e4e4e7] outline-none focus:border-[#52525b]" placeholder="https://wago.example.com" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">{copy.apiKey}</span>
              <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="off" className="w-full rounded-lg border border-[#2a2a2a] bg-[#111] px-3 py-2.5 font-mono text-sm text-[#e4e4e7] outline-none focus:border-[#52525b]" placeholder="wa_..." />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">{copy.endpoint}</span>
            <select value={endpoint.id} onChange={(event) => selectEndpoint(event.target.value)} className="w-full rounded-lg border border-[#2a2a2a] bg-[#111] px-3 py-2.5 text-sm text-[#e4e4e7] outline-none focus:border-[#52525b]">
              {Object.entries(groupLabels).map(([group, labels]) => (
                <optgroup key={group} label={labels[lang]}>
                  {apiEndpoints.filter((item) => item.group === group).map((item) => (
                    <option key={item.id} value={item.id}>{item.method} {item.path} — {item.title[lang]}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <div className="rounded-lg border border-[#262626] bg-[#111] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-2 py-1 font-mono text-xs font-semibold ${endpoint.method === "GET" ? "bg-emerald-950 text-emerald-300" : "bg-blue-950 text-blue-300"}`}>{endpoint.method}</span>
              <code className="text-sm text-[#fafafa]">{endpoint.path}</code>
              <span className="rounded-full border border-[#303030] px-2 py-0.5 text-[11px] text-[#71717a]">{authLabel(endpoint, lang)}</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#a1a1aa]">{endpoint.description[lang]}</p>
          </div>

          {endpoint.fields.length > 0 && (
            <div className="space-y-4">
              {endpoint.fields.map((field) => (
                <label key={`${field.location}-${field.key}`} className="block">
                  <span className="mb-1.5 flex items-center gap-2 text-xs font-medium text-[#a1a1aa]">
                    {field.label[lang]}
                    <span className="text-[10px] uppercase tracking-wide text-[#52525b]">{field.location}</span>
                    <span className="text-[10px] text-[#52525b]">{field.required ? copy.required : copy.optional}</span>
                  </span>
                  {field.input === "select" ? (
                    <select value={values[field.key] ?? ""} onChange={(event) => setField(field.key, event.target.value)} className="w-full rounded-lg border border-[#2a2a2a] bg-[#111] px-3 py-2.5 text-sm text-[#e4e4e7] outline-none focus:border-[#52525b]">
                      {(field.options ?? []).map((option) => <option key={option || "__empty"} value={option}>{option || (lang === "id" ? "Semua / kosong" : "All / empty")}</option>)}
                    </select>
                  ) : field.input === "textarea" ? (
                    <textarea value={values[field.key] ?? ""} onChange={(event) => setField(field.key, event.target.value)} rows={4} className="w-full resize-y rounded-lg border border-[#2a2a2a] bg-[#111] px-3 py-2.5 text-sm text-[#e4e4e7] outline-none focus:border-[#52525b]" placeholder={field.placeholder} />
                  ) : (
                    <input value={values[field.key] ?? ""} onChange={(event) => setField(field.key, event.target.value)} className="w-full rounded-lg border border-[#2a2a2a] bg-[#111] px-3 py-2.5 font-mono text-sm text-[#e4e4e7] outline-none focus:border-[#52525b]" placeholder={field.placeholder} />
                  )}
                  <span className="mt-1.5 block text-xs leading-relaxed text-[#52525b]">{field.description[lang]}</span>
                </label>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={requestLive} disabled={sending} className="rounded-lg bg-[#fafafa] px-4 py-2.5 text-sm font-semibold text-[#0a0a0a] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">{sending ? copy.sending : copy.send}</button>
            {response && <button type="button" onClick={() => setResponse(null)} className="rounded-lg border border-[#2a2a2a] px-4 py-2.5 text-sm text-[#a1a1aa] hover:text-[#fafafa]">{copy.clear}</button>}
          </div>

          {confirmationOpen && (
            <div className={`rounded-lg border p-4 ${endpoint.danger === "high" ? "border-red-900 bg-red-950/20" : "border-amber-900 bg-amber-950/20"}`}>
              <p className="text-sm font-semibold text-[#fafafa]">{endpoint.danger === "high" ? (lang === "id" ? "Tindakan ini mengganti session WhatsApp saat ini" : "This replaces the current WhatsApp session") : (lang === "id" ? "Konfirmasi perubahan state" : "Confirm state-changing request")}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-[#a1a1aa]">{endpoint.danger === "high" ? (lang === "id" ? "Rebind akan menghapus auth/binding lama dan memulai pairing akun baru. Gunakan hanya jika memang ingin mengganti akun atau memulihkan session." : "Rebind clears the previous auth/binding and starts pairing a replacement account. Use it only when intentionally changing accounts or recovering the session.") : (lang === "id" ? "Endpoint POST dapat mengubah state gateway atau mengirim pesan. Periksa Base URL dan input sebelum melanjutkan." : "POST endpoints can change gateway state or send a message. Verify the Base URL and request values before continuing.")}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => void executeRequest()} className="rounded-md bg-[#fafafa] px-3 py-2 text-xs font-semibold text-[#0a0a0a]">{copy.confirm}</button>
                <button type="button" onClick={() => setConfirmationOpen(false)} className="rounded-md border border-[#3f3f46] px-3 py-2 text-xs text-[#a1a1aa]">{copy.cancel}</button>
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-5">
          <div className="overflow-hidden rounded-lg border border-[#262626] bg-[#111]">
            <div className="flex items-center justify-between gap-3 border-b border-[#262626]">
              <div className="flex min-w-0 overflow-x-auto">
                {snippetTabs.map((tab) => <button type="button" key={tab.id} onClick={() => setSnippetLanguage(tab.id)} className={`whitespace-nowrap border-b-2 px-3 py-3 text-xs ${snippetLanguage === tab.id ? "border-[#fafafa] text-[#fafafa]" : "border-transparent text-[#52525b] hover:text-[#a1a1aa]"}`}>{tab.label}</button>)}
              </div>
              <button type="button" onClick={() => void copySnippet()} className="mr-2 shrink-0 rounded-md border border-[#303030] px-2.5 py-1.5 text-xs text-[#a1a1aa] hover:text-[#fafafa]">{copied ? copy.copied : copy.copy}</button>
            </div>
            <pre className="m-0 max-h-[430px] overflow-auto p-4 text-xs leading-6 text-[#d4d4d8]"><code>{snippet}</code></pre>
          </div>

          <div className="overflow-hidden rounded-lg border border-[#262626] bg-[#111]">
            <div className="flex min-h-12 flex-wrap items-center gap-2 border-b border-[#262626] px-4 py-2">
              <span className="text-xs font-semibold text-[#fafafa]">{copy.response}</span>
              {response?.status !== undefined && <span className={`rounded px-2 py-0.5 font-mono text-[11px] ${response.ok ? "bg-emerald-950 text-emerald-300" : "bg-red-950 text-red-300"}`}>HTTP {response.status}</span>}
              {response?.elapsedMs !== undefined && <span className="text-[11px] text-[#52525b]">{response.elapsedMs} ms</span>}
              {response?.contentType && <span className="text-[11px] text-[#52525b]">{response.contentType}</span>}
            </div>
            <pre className="m-0 min-h-40 max-h-[430px] overflow-auto whitespace-pre-wrap break-words p-4 text-xs leading-6 text-[#d4d4d8]"><code>{response?.body ?? (lang === "id" ? "Response live akan muncul di sini. Tidak ada request yang dikirim sampai Anda menekan tombol Kirim request." : "Live response appears here. No request is sent until you click Send request.")}</code></pre>
          </div>

          <p className="text-xs leading-relaxed text-[#52525b]">{lang === "id" ? "Live mode berjalan langsung dari browser ke Base URL Wago yang Anda isi. Dokumentasi ini tidak memiliki proxy, tidak menyimpan history request, dan tidak dapat melewati same-origin/CORS policy browser." : "Live mode runs directly from your browser to the Wago Base URL you enter. This documentation has no proxy, stores no request history, and cannot bypass browser same-origin/CORS policy."}</p>
        </div>
      </div>
    </div>
  );
}