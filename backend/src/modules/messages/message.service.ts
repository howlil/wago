export type SendMessageCommand = {
  to: string;
  text: string;
  idempotencyKey?: string;
};

export type MessageSendOptions = {
  idempotencyKey?: string;
};

export type MessageSendResult = {
  messageId: string | null;
  status: "pending";
};

export type MessageDeliveryStatus = "pending" | "accepted" | "delivered" | "read" | "rejected";

export type MessageStatus = {
  id: string;
  to: string;
  status: MessageDeliveryStatus;
  error?: string;
  message?: string;
  updatedAt: string;
};

export type MessageService = {
  send: (command: SendMessageCommand) => Promise<MessageSendResult>;
  findStatus: (messageId: string) => MessageStatus | null | undefined;
};

type MessageServiceDependencies = {
  sendText: (to: string, text: string, options?: MessageSendOptions) => Promise<MessageSendResult>;
  getStatus: (messageId: string) => MessageStatus | null | undefined;
};

export function createMessageService(deps: MessageServiceDependencies): MessageService {
  return {
    send(command: SendMessageCommand): Promise<MessageSendResult> {
      return deps.sendText(command.to, command.text, {
        idempotencyKey: command.idempotencyKey,
      });
    },
    findStatus(messageId: string): MessageStatus | null | undefined {
      return deps.getStatus(messageId);
    },
  };
}
