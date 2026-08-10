import {
  getMessageStatus,
  type SendTextMessageOptions,
  type SendTextMessageResult,
  type StoredMessageStatus,
  sendTextMessage,
} from "../../whatsapp.js";

export type SendMessageCommand = {
  to: string;
  text: string;
  idempotencyKey?: string;
};

type MessageServiceDependencies = {
  sendText: (to: string, text: string, options?: SendTextMessageOptions) => Promise<SendTextMessageResult>;
  getStatus: (messageId: string) => StoredMessageStatus | null | undefined;
};

export function createMessageService(deps: MessageServiceDependencies) {
  return {
    send(command: SendMessageCommand): Promise<SendTextMessageResult> {
      return deps.sendText(command.to, command.text, {
        idempotencyKey: command.idempotencyKey,
      });
    },
    findStatus(messageId: string): StoredMessageStatus | null | undefined {
      return deps.getStatus(messageId);
    },
  };
}

export const messageService = createMessageService({
  sendText: sendTextMessage,
  getStatus: getMessageStatus,
});
