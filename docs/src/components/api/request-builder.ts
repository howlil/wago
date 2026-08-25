import type { ApiEndpoint, ApiField } from "./types";

export type ExplorerValues = Record<string, string>;
export type SnippetLanguage = "curl" | "javascript" | "python" | "nodejs";
export type BuiltRequest = { url: string; init: RequestInit };

function fieldWireName(field: ApiField): string {
  return field.wireName ?? field.key;
}

function valueForField(field: ApiField, values: ExplorerValues): string {
  const explicit = values[field.key]?.trim();
  if (explicit) {
    return explicit;
  }

  return field.defaultValue?.trim() ?? "";
}

function exampleValueForField(field: ApiField, values: ExplorerValues): string {
  const explicit = values[field.key]?.trim();
  if (explicit) {
    return explicit;
  }

  if (field.defaultValue?.trim()) {
    return field.defaultValue.trim();
  }

  if (field.placeholder?.trim()) {
    return field.placeholder.trim();
  }

  return field.required ? `<${field.key}>` : "";
}

function buildUrl(endpoint: ApiEndpoint, baseUrl: string, values: ExplorerValues, useExamples: boolean): string {
  const normalizedBase = baseUrl.trim().replace(/\/+$/, "") || "http://localhost:3000";
  let path = endpoint.path;

  for (const field of endpoint.fields.filter((item) => item.location === "path")) {
    const raw = useExamples ? exampleValueForField(field, values) : valueForField(field, values);
    path = path.replace(`:${field.key}`, encodeURIComponent(raw));
  }

  const query = new URLSearchParams();
  for (const field of endpoint.fields.filter((item) => item.location === "query")) {
    const raw = useExamples ? exampleValueForField(field, values) : valueForField(field, values);
    if (raw) {
      query.set(fieldWireName(field), raw);
    }
  }

  const queryText = query.toString();
  return `${normalizedBase}${path}${queryText ? `?${queryText}` : ""}`;
}

function collectBody(endpoint: ApiEndpoint, values: ExplorerValues, useExamples: boolean): Record<string, string> {
  const body: Record<string, string> = {};

  for (const field of endpoint.fields.filter((item) => item.location === "body")) {
    const raw = useExamples ? exampleValueForField(field, values) : valueForField(field, values);
    if (raw) {
      body[fieldWireName(field)] = raw;
    }
  }

  return body;
}

function collectHeaderFields(
  endpoint: ApiEndpoint,
  values: ExplorerValues,
  useExamples: boolean,
): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const field of endpoint.fields.filter((item) => item.location === "header")) {
    const raw = useExamples ? exampleValueForField(field, values) : valueForField(field, values);
    if (raw) {
      headers[fieldWireName(field)] = raw;
    }
  }

  return headers;
}

export function buildLiveRequest(input: {
  endpoint: ApiEndpoint;
  baseUrl: string;
  apiKey: string;
  values: ExplorerValues;
}): BuiltRequest {
  const { endpoint, baseUrl, apiKey, values } = input;
  const url = buildUrl(endpoint, baseUrl, values, false);
  const headers = new Headers();

  if (endpoint.auth === "api-key" && apiKey.trim()) {
    headers.set("Authorization", `Bearer ${apiKey.trim()}`);
  }

  for (const [key, value] of Object.entries(collectHeaderFields(endpoint, values, false))) {
    headers.set(key, value);
  }

  const body = collectBody(endpoint, values, false);
  const hasBody = endpoint.method === "POST" && Object.keys(body).length > 0;

  if (hasBody) {
    headers.set("Content-Type", "application/json");
  }

  return {
    url,
    init: {
      method: endpoint.method,
      headers,
      ...(hasBody ? { body: JSON.stringify(body) } : {}),
    },
  };
}

function curlSnippet(
  endpoint: ApiEndpoint,
  url: string,
  body: Record<string, string>,
  headers: Record<string, string>,
): string {
  const lines = [`curl${endpoint.method === "POST" ? " -X POST" : ""} "${url}"`];

  if (endpoint.auth === "api-key") {
    lines.push('  -H "Authorization: Bearer YOUR_API_KEY"');
  }

  for (const [key, value] of Object.entries(headers)) {
    lines.push(`  -H "${key}: ${value}"`);
  }

  if (Object.keys(body).length > 0) {
    lines.push('  -H "Content-Type: application/json"');
    lines.push(`  -d '${JSON.stringify(body)}'`);
  }

  return lines.join(" \\\n");
}

function javascriptSnippet(
  endpoint: ApiEndpoint,
  url: string,
  body: Record<string, string>,
  headers: Record<string, string>,
): string {
  const headerLines: string[] = [];

  if (endpoint.auth === "api-key") {
    headerLines.push('    Authorization: "Bearer YOUR_API_KEY",');
  }

  for (const [key, value] of Object.entries(headers)) {
    headerLines.push(`    "${key}": ${JSON.stringify(value)},`);
  }

  if (Object.keys(body).length > 0) {
    headerLines.push('    "Content-Type": "application/json",');
  }

  const options = [
    "{",
    `  method: "${endpoint.method}",`,
    ...(headerLines.length > 0 ? ["  headers: {", ...headerLines, "  },"] : []),
    ...(Object.keys(body).length > 0 ? [`  body: JSON.stringify(${JSON.stringify(body, null, 2)}),`] : []),
    "}",
  ].join("\n");

  return `const response = await fetch(${JSON.stringify(url)}, ${options});\nconst data = await response.text();\nconsole.log(response.status, data);`;
}

function pythonSnippet(
  endpoint: ApiEndpoint,
  url: string,
  body: Record<string, string>,
  headers: Record<string, string>,
): string {
  const pythonHeaders: Record<string, string> = { ...headers };
  if (endpoint.auth === "api-key") {
    pythonHeaders.Authorization = "Bearer YOUR_API_KEY";
  }

  const method = endpoint.method.toLowerCase();
  const args = [
    JSON.stringify(url),
    ...(Object.keys(pythonHeaders).length > 0
      ? [`headers=${JSON.stringify(pythonHeaders).replaceAll(":", ": ").replaceAll(",", ", ")}`]
      : []),
    ...(Object.keys(body).length > 0
      ? [`json=${JSON.stringify(body).replaceAll(":", ": ").replaceAll(",", ", ")}`]
      : []),
    "timeout=30",
  ];

  return `import requests\n\nresponse = requests.${method}(\n    ${args.join(",\n    ")}\n)\nprint(response.status_code)\nprint(response.text)`;
}

export function buildSnippet(input: {
  endpoint: ApiEndpoint;
  baseUrl: string;
  values: ExplorerValues;
  language: SnippetLanguage;
}): string {
  const { endpoint, baseUrl, values, language } = input;
  const url = buildUrl(endpoint, baseUrl, values, true);
  const body = collectBody(endpoint, values, true);
  const headers = collectHeaderFields(endpoint, values, true);

  if (language === "curl") {
    return curlSnippet(endpoint, url, body, headers);
  }

  if (language === "python") {
    return pythonSnippet(endpoint, url, body, headers);
  }

  return javascriptSnippet(endpoint, url, body, headers);
}
