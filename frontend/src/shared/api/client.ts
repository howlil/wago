const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

type RequestJsonOptions = {
  allowedStatuses?: number[];
};

export async function requestJson<T>(path: string, init?: RequestInit, options: RequestJsonOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
  });
  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json")
    ? ((await response.json()) as T)
    : ({
        success: false,
        error: "NON_JSON_RESPONSE",
        message: await response.text(),
      } as T);

  if (!response.ok && !options.allowedStatuses?.includes(response.status)) {
    throw data;
  }

  return data;
}

export async function requestText(path: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.text();
}
