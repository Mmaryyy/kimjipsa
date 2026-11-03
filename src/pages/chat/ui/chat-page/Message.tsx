import { Sparkles } from "lucide-react";
import type { Chat, Receipt, ActionProposal } from "@/entities/chat-message";
import { Text } from "@/shared/ui";
import { messageBubbleStyles, messageRowStyles } from "./chat.variants";
import ChatPhoto from "./Photo";
import ChatRun from "./Run";
import ReceiptCard from "./Receipt";
import ChatActionProposal from "./Proposal";

const timestamp = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
interface Props {
  message: Chat["messages"][number];
  attachments: Map<string, Chat["attachments"][number]>;
  run?: Chat["runs"][number];
  receipt?: Receipt;
  proposal?: ActionProposal;
  now: number;
  workerOnline: boolean;
  cancelling: boolean;
  onCancel: (id: string) => void;
}
const ChatMessage = ({
  message,
  attachments,
  run,
  receipt,
  proposal,
  now,
  workerOnline,
  cancelling,
  onCancel,
}: Props) => (
  <li data-message-id={message.id} className="space-y-2">
    <div className={messageRowStyles({ role: message.role })}>
      {message.role === "assistant" && (
        <Sparkles
          className="mt-2 size-5 shrink-0 text-bot-text"
          aria-hidden="true"
        />
      )}
      <div className="min-w-0 max-w-[90%] space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-caption text-muted-foreground">
          <span>{message.author}</span>
          <time dateTime={message.created_at}>
            {timestamp.format(new Date(message.created_at))}
          </time>
        </div>
        <div className={messageBubbleStyles({ role: message.role })}>
          {message.text && (
            <Text as="p" className="whitespace-pre-wrap break-words">
              {message.text}
            </Text>
          )}
          {message.sources.length > 0 && (
            <ol
              aria-label="웹 검색 출처"
              className="mt-3 space-y-1 text-caption"
            >
              {message.sources.map((source, index) => (
                <li key={source.url}>
                  <a
                    className="text-primary underline break-all"
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    [{index + 1}] {source.title || new URL(source.url).hostname}
                  </a>
                </li>
              ))}
            </ol>
          )}
          {message.attachment_ids.length > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {message.attachment_ids.map((id) => {
                const attachment = attachments.get(id);
                return (
                  <ChatPhoto
                    key={id}
                    id={id}
                    expired={
                      !attachment ||
                      attachment.status === "deleted" ||
                      Date.parse(attachment.expires_at) <= now
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
    {run && (
      <ChatRun
        run={run}
        receipt={receipt}
        proposal={proposal}
        workerOnline={workerOnline}
        hasPhotos={message.attachment_ids.length > 0}
        cancelling={cancelling}
        now={now}
        onCancel={onCancel}
      />
    )}
    {proposal && (
      <ChatActionProposal
        key={`${proposal.id}:${proposal.version}`}
        proposal={proposal}
        now={now}
      />
    )}
    {receipt && (
      <ReceiptCard
        key={`${receipt.id}:${receipt.version}`}
        receipt={receipt}
        now={now}
      />
    )}
  </li>
);
export default ChatMessage;
