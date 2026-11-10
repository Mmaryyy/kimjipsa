import type { ActionProposal, Chat, Receipt } from "@/entities/chat-message";
import { Button, Message, MessageContent, Text } from "@/shared/ui";

import ChatActionProposal from "./Proposal";
import ChatAvatar from "./Avatar";
import ChatPhoto from "./Photo";
import ChatRun, { ChatRunCaption } from "./Run";
import ChatTime from "./Time";
import ReceiptCard from "./Receipt";
import { cn } from "@/shared/lib";

interface Props {
  name?: string;
  message: Chat["messages"][number];
  attachments: Map<string, Chat["attachments"][number]>;
  run?: Chat["runs"][number];
  receipt?: Receipt;
  proposal?: ActionProposal;
  now: number;
  cancelling: boolean;
  retrying: boolean;
  canRetry?: boolean;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  choicesDisabled?: boolean;
  selectedChoice?: string;
  onChoice?: (label: string) => void;
}
const ChatMessage = ({
  name = "집사",
  message,
  attachments,
  run,
  receipt,
  proposal,
  now,
  cancelling,
  retrying,
  canRetry = false,
  onRetry,
  onCancel,
  choicesDisabled = true,
  selectedChoice,
  onChoice,
}: Props) => (
  <li data-message-id={message.id} className="space-y-2">
    <Message from={message.role}>
      <div
        className={cn(
          "grid min-w-0 grid-cols-1 gap-y-1",
          "group-[.is-assistant]:grid-cols-[48px_minmax(0,1fr)] group-[.is-assistant]:gap-x-2",
        )}
      >
        {message.role === "assistant" && <ChatAvatar />}
        <span className="sr-only">
          {message.role === "user" ? "나" : message.author}
        </span>
        <MessageContent
          className={cn(
            "group-[.is-assistant]:col-start-2",
            message.role === "user" && "block flow-root",
          )}
        >
          {message.text && (
            <Text
              as="p"
              variant="body-sm"
              className={cn(
                "whitespace-pre-wrap break-words leading-[1.55]",
                message.role === "user" && "inline",
              )}
            >
              {message.text}
            </Text>
          )}
          {message.role === "assistant" && message.choices.length > 0 && (
            <div
              role="group"
              aria-label="답 고르기"
              className="flex flex-wrap gap-2"
            >
              {message.choices.map((choice) => (
                <Button
                  key={choice.value}
                  variant="gray"
                  size="sm"
                  className={cn(
                    "rounded-full border border-[var(--separator)] bg-transparent px-3 py-1",
                    "text-caption text-foreground aria-pressed:border-primary",
                    "aria-pressed:bg-[var(--accent-soft)] aria-pressed:text-primary disabled:opacity-40",
                  )}
                  aria-pressed={choice.label === selectedChoice}
                  disabled={choicesDisabled}
                  onClick={() => onChoice?.(choice.label)}
                >
                  {choice.label}
                </Button>
              ))}
            </div>
          )}
          {message.sources.length > 0 && (
            <ol aria-label="웹 검색 출처" className="space-y-1 text-caption">
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
            <div className="grid grid-cols-2 gap-2">
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
          {message.role === "user" ? (
            <ChatRunCaption run={run} createdAt={message.created_at} />
          ) : (
            <ChatTime value={message.created_at} />
          )}
        </MessageContent>
        {run && message.role === "user" && (
          <ChatRun
            run={run}
            cancelling={cancelling}
            retrying={retrying}
            canRetry={canRetry}
            onRetry={onRetry}
            now={now}
            onCancel={onCancel}
          />
        )}
      </div>
    </Message>
    {run?.status === "running" && message.role === "user" && (
      <Message from="assistant">
        <div className="grid min-w-0 grid-cols-[48px_minmax(0,1fr)] gap-x-2">
          <ChatAvatar />
          <MessageContent className="min-h-12 justify-center">
            <span>
              <span className="sr-only">집사가 답을 쓰는 중</span>
              <span
                aria-hidden="true"
                className="flex gap-1 text-muted-foreground"
              >
                <span className="size-1.5 rounded-full bg-current motion-safe:animate-bounce" />
                <span className="size-1.5 rounded-full bg-current motion-safe:animate-bounce [animation-delay:150ms]" />
                <span className="size-1.5 rounded-full bg-current motion-safe:animate-bounce [animation-delay:300ms]" />
              </span>
            </span>
          </MessageContent>
        </div>
      </Message>
    )}
    {(proposal || receipt) && (
      <Message from="assistant">
        <div className="grid min-w-0 grid-cols-[48px_minmax(0,1fr)] gap-x-2">
          <ChatAvatar />
          <span className="sr-only">김{name}</span>
          <MessageContent className="col-start-2">
            {proposal && (
              <ChatActionProposal
                key={proposal.id}
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
            <ChatTime value={run?.created_at ?? message.created_at} />
          </MessageContent>
        </div>
      </Message>
    )}
  </li>
);
export default ChatMessage;
