export type MessageRejection = {
  code: "MESSAGE_REJECTED" | "REACHOUT_RESTRICTED";
  message: string;
};

export function mapMessageRejection(parameters?: string[] | null): MessageRejection {
  const [code, detail] = parameters ?? [];

  if (code === "463") {
    return {
      code: "REACHOUT_RESTRICTED",
      message:
        "WhatsApp rejected the message because this account is restricted from starting this chat or the contact token is missing",
    };
  }

  return {
    code: "MESSAGE_REJECTED",
    message: detail ?? "WhatsApp rejected the message",
  };
}
