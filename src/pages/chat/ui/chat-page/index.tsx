"use client";
import { useCallback, useMemo, useState } from "react";
import { ArrowDown } from "lucide-react";
import { useAccount } from "@/features/account";
import { ChatComposer } from "@/features/chat-send";
import {
  useChat,
  useChatActions,
  type ChatVisibility,
} from "@/entities/chat-message";
import { Button, ErrorState, PageLayout, Skeleton, Text } from "@/shared/ui";
import { useChatClock } from "../../model/use-chat-clock";
import { useChatScroll } from "../../model/use-chat-scroll";
import { useChatViewport } from "../../model/use-chat-viewport";
import ChatHeader from "./Header";
import ChatMessage from "./Message";
import ChatWelcome from "./Welcome";

const ChatPage = () => {
  const [visibility, setVisibility] = useState<ChatVisibility>("shared");
  const account = useAccount();
  const query = useChat(
    account.data?.membership?.familyId,
    visibility,
    account.data?.userId,
  );
  const { cancel } = useChatActions();
  const now = useChatClock();
  const { viewportRef, contentRef, onScroll, onLatest, awayFromBottom } =
    useChatScroll();
  useChatViewport();
  const chat = query.data;
  const runs = useMemo(
    () => new Map(chat?.runs.map((run) => [run.input_message_id, run])),
    [chat?.runs],
  );
  const receipts = useMemo(
    () => new Map(chat?.receipts.map((receipt) => [receipt.run_id, receipt])),
    [chat?.receipts],
  );
  const proposals = useMemo(
    () =>
      new Map(chat?.proposals.map((proposal) => [proposal.run_id, proposal])),
    [chat?.proposals],
  );
  const attachments = useMemo(
    () =>
      new Map(
        chat?.attachments.map((attachment) => [attachment.id, attachment]),
      ),
    [chat?.attachments],
  );
  const onCancel = useCallback((id: string) => cancel.mutate(id), [cancel]);
  const onRefetch = useCallback(() => {
    void query.refetch();
  }, [query]);
  return (
    <PageLayout
      width="narrow"
      odId="chat-main"
      className="fixed inset-x-0 top-[var(--chat-viewport-top,0px)] z-30 mx-auto flex h-[var(--chat-viewport-height,100dvh)] max-w-content-max flex-col overflow-hidden bg-background lg:left-62"
      header={
        <ChatHeader
          visibility={visibility}
          onVisibilityChange={setVisibility}
          name={chat?.name ?? "집사"}
          online={chat?.workerOnline}
          failed={query.isError}
        />
      }
    >
      <div
        ref={viewportRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4"
        aria-label="대화 내역"
        tabIndex={0}
      >
        <div ref={contentRef} className="pb-6">
          {query.isPending && (
            <div
              className="space-y-6 py-6"
              role="status"
              aria-label="대화를 불러오는 중"
            >
              <Skeleton className="h-16 w-3/4" />
              <Skeleton className="ml-auto h-12 w-2/3" />
              <Skeleton className="h-24 w-3/4" />
            </div>
          )}
          {query.error && (
            <ErrorState
              message={query.error.message}
              onRetry={onRefetch}
              retrying={query.isFetching}
            />
          )}
          {!query.isPending && (!chat || chat.messages.length === 0) && (
            <ChatWelcome />
          )}
          {chat && !chat.workerOnline && (
            <Text as="p" variant="caption" className="py-3 text-warning-text">
              맥미니 연결을 기다리고 있어요. 보낸 요청은 연결되면 처리해요.
            </Text>
          )}
          <ol
            role="log"
            aria-label={
              visibility === "private" ? "나만 보는 대화" : "가족 대화"
            }
            aria-live="polite"
            aria-relevant="additions text"
            className="space-y-6"
          >
            {chat?.messages.map((message) => {
              const run = runs.get(message.id);
              return (
                <ChatMessage
                  key={message.id}
                  message={message}
                  attachments={attachments}
                  run={run}
                  receipt={run ? receipts.get(run.id) : undefined}
                  proposal={run ? proposals.get(run.id) : undefined}
                  now={now}
                  workerOnline={chat.workerOnline}
                  cancelling={cancel.isPending}
                  onCancel={onCancel}
                />
              );
            })}
          </ol>
          {cancel.error && (
            <Text as="p" role="alert" className="py-3 text-error-text">
              {cancel.error.message}
            </Text>
          )}
        </div>
      </div>
      {awayFromBottom && (
        <div className="flex justify-center py-2">
          <Button variant="glass" size="sm" onClick={onLatest}>
            <ArrowDown className="size-4" aria-hidden="true" />
            최근 대화 보기
          </Button>
        </div>
      )}
      <div className="shrink-0 bg-background px-4 pt-2 pb-[max(var(--sp-3),env(safe-area-inset-bottom))]">
        <ChatComposer
          key={visibility}
          visibility={visibility}
          disabled={!chat || query.isError}
        />
      </div>
    </PageLayout>
  );
};
export default ChatPage;
