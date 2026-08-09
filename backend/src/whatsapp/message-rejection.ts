export function mapMessageRejection(parameters?: string[] | null): { error: string; message: string } {
  const [code, detail] = parameters ?? [];

  if (code === "463") {
    return {
      error: "REACHOUT_RESTRICTED",
      message:
        "WhatsApp rejected the message because this account is restricted from starting this chat or the contact token is missing"
    };
  }

  return {
    error: "MESSAGE_REJECTED",
    message: detail ?? "WhatsApp rejected the message"
  };
}
