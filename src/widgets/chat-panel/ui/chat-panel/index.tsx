"use client";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useChatNavigation } from "@/features/chat-navigation";
import { useAccount } from "@/features/account";
import { ChatComposer } from "@/features/chat-send";
import { useChat, useChatActions } from "@/entities/chat-message";
import {
  Button,
  ErrorState,
  Sheet,
  Skeleton,
  Text,
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/shared/ui";
import { useChatClock } from "../../model/use-chat-clock";
import { useChatScroll } from "../../model/use-chat-scroll";
import { useChatViewport } from "../../model/use-chat-viewport";
import ChatHeader from "./Header";
import ChatMessage from "./Message";
import ChatMessages from "./Messages";

const ChatPanelConversation = () => {
  const account = useAccount();
  const query = useChat(
    account.data?.membership?.familyId,
    account.data?.userId,
  );
  const { cancel } = useChatActions();
  const now = useChatClock();
  const chat =
    query.data &&
    (!query.data.expiresAt || Date.parse(query.data.expiresAt) > now)
      ? query.data
      : undefined;
  const { fetchNextPage } = query;
  const onLoadOlder = useCallback(
    () => fetchNextPage({ cancelRefetch: false }),
    [fetchNextPage],
  );
  const {
    viewportRef,
    contentRef,
    onScroll,
    onLatest,
    onOlder,
    awayFromBottom,
  } = useChatScroll({
    scope: `${account.data?.membership?.familyId}:${account.data?.userId}:${query.data?.sessionVersion}`,
    messages: chat?.messages,
    hasOlder: query.hasNextPage,
    fetching: query.isFetching,
    olderFailed: query.isFetchNextPageError,
    onLoadOlder,
  });
  useChatViewport();
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
  const composerRef = useRef<HTMLDivElement>(null);
  const composerDisabled =
    !chat || (query.isError && !query.isFetchNextPageError);
  useEffect(() => {
    // 첫 조회가 끝나도 사용자가 옮긴 포커스는 가져오지 않아요.
    if (
      !composerDisabled &&
      !window.matchMedia("(pointer: coarse)").matches &&
      document.activeElement === viewportRef.current
    ) {
      composerRef.current
        ?.querySelector("textarea")
        ?.focus({ preventScroll: true });
    }
  }, [composerDisabled, viewportRef]);
  const onCancel = useCallback((id: string) => cancel.mutate(id), [cancel]);
  const onRefetch = useCallback(() => {
    void query.refetch();
  }, [query]);
  return (
    <>
      <ChatHeader
        name={chat?.name ?? "집사"}
        online={chat?.workerOnline}
        failed={query.isError && !query.isFetchNextPageError}
      />

      <Conversation className="min-h-0">
        <ConversationContent
          viewportRef={viewportRef}
          contentRef={contentRef}
          onScroll={onScroll}
          scrollClassName="overscroll-contain px-4 [overflow-anchor:none]"
          className="gap-0 p-0 pb-6"
          aria-label="대화 내역"
          tabIndex={-1}
        >
          {(query.isPending || (!chat && !query.isError)) && (
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
          {query.error && !query.isFetchNextPageError && (
            <ErrorState
              message={query.error.message}
              onRetry={onRefetch}
              retrying={query.isFetching}
            />
          )}
          {chat && !chat.workerOnline && (
            <Text as="p" variant="caption" className="py-3 text-warning-text">
              맥미니 연결을 기다리고 있어요. 보낸 요청은 연결되면 처리해요.
            </Text>
          )}
          {chat && query.hasNextPage && (
            <div className="flex flex-col items-center gap-2 py-3">
              {query.isFetchNextPageError && (
                <Text
                  as="p"
                  role="alert"
                  variant="caption"
                  className="text-error-text"
                >
                  이전 대화를 불러오지 못했어요. 다시 시도해 주세요.
                </Text>
              )}
              <Button
                variant="glass"
                size="sm"
                onClick={onOlder}
                disabled={query.isFetching}
              >
                {query.isFetchingNextPage
                  ? "이전 대화를 불러오는 중…"
                  : "이전 대화 불러오기"}
              </Button>
            </div>
          )}
          <ol
            role="log"
            aria-label="나만 보는 대화"
            aria-live={query.isFetchingNextPage ? "off" : "polite"}
            aria-relevant="additions text"
            className="space-y-6"
          >
            {chat && (
              <ChatMessages
                key={chat.sessionVersion}
                messages={chat.messages}
                name={chat.name}
                displayName={account.data?.profile?.displayName ?? "사용자"}
              >
                {(message) => {
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
                      cancelling={cancel.isPending}
                      onCancel={onCancel}
                    />
                  );
                }}
              </ChatMessages>
            )}
          </ol>
          {cancel.error && (
            <Text as="p" role="alert" className="py-3 text-error-text">
              {cancel.error.message}
            </Text>
          )}
        </ConversationContent>
        <ConversationScrollButton visible={awayFromBottom} onClick={onLatest}>
          최근 대화 보기
        </ConversationScrollButton>
      </Conversation>
      <div
        ref={composerRef}
        className="shrink-0 bg-background px-4 pt-2 pb-[max(var(--sp-3),env(safe-area-inset-bottom))]"
      >
        <ChatComposer
          key={chat?.sessionVersion ?? "loading"}
          sessionVersion={chat?.sessionVersion ?? 1}
          disabled={composerDisabled}
        />
      </div>
    </>
  );
};
const ChatPanel = () => {
  const { open, onClose, onRestoreFocus } = useChatNavigation();
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      presentation="panel"
      overlayClassName="md:bg-transparent"
      className="top-[var(--chat-viewport-top,0px)] h-[var(--chat-viewport-height,100dvh)]"
      title="집사와 대화"
      description="나만 보는 개인 대화"
      odId="chat-panel"
      hideHeader
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        const panel = event.target as HTMLElement;
        const conversation = panel.querySelector<HTMLElement>(
          '[aria-label="대화 내역"]',
        );
        const input = panel.querySelector<HTMLTextAreaElement>(
          "textarea:not(:disabled)",
        );
        const target = window.matchMedia("(pointer: coarse)").matches
          ? conversation
          : (input ?? conversation);
        target?.focus({ preventScroll: true });
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onRestoreFocus();
      }}
      onEscapeKeyDown={(event) => {
        if (event.isComposing || event.keyCode === 229) {
          event.preventDefault();
          return;
        }
        const input = document.activeElement;
        if (
          (input instanceof HTMLTextAreaElement ||
            input instanceof HTMLInputElement) &&
          input.value.length > 0
        ) {
          event.preventDefault();
          input.blur();
        }
      }}
    >
      {open && <ChatPanelConversation />}
    </Sheet>
  );
};
export default ChatPanel;
