export async function formatExplorerResponse(response: Response): Promise<{
  contentType: string;
  body: string;
}> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();

  if (contentType.toLowerCase().includes("application/json")) {
    try {
      return {
        contentType,
        body: JSON.stringify(JSON.parse(text), null, 2),
      };
    } catch {
      return { contentType, body: text };
    }
  }

  return { contentType, body: text };
}
