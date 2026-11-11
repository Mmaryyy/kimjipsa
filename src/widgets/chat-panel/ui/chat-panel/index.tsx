"use client";

import {
  Button,
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  ErrorState,
  Sheet,
  Skeleton,
  SkeletonSection,
  SkeletonStatus,
  Text,
} from "@/shared/ui";
import { ChatComposer, useChatSend } from "@/features/chat-send";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useChat, useChatActions } from "@/entities/chat-message";

import ChatHeader from "./Header";
import ChatMessage from "./Message";
import ChatMessages from "./Messages";
import { useAccount } from "@/features/account";
import { useChatClock } from "../../model/use-chat-clock";
import { useChatNavigation } from "@/features/chat-navigation";
import { useChatScroll } from "../../model/use-chat-scroll";
import { useChatViewport } from "../../model/use-chat-viewport";

const ChatPanelConversation = () => {
  const account = useAccount();
  const query = useChat(
    account.data?.membership?.familyId,
    account.data?.userId,
  );
  const { cancel, retry } = useChatActions();
  const now = useChatClock();
  const chat =
    query.data &&
    (!query.data.expiresAt || Date.parse(query.data.expiresAt) > now)
      ? query.data
      : undefined;
  const reply = useChatSend(chat?.sessionVersion ?? 1);
  const choiceDisabled =
    reply.send.isPending ||
    reply.upload.isPending ||
    query.isError ||
    !chat ||
    chat.runs.some(
      (run) => run.status === "queued" || run.status === "running",
    );
  const onChoice = useCallback(
    (label: string) => {
      if (!choiceDisabled) reply.send.mutate(label);
    },
    [choiceDisabled, reply.send],
  );
  const retryLock = useRef(false);
  const onRetry = useCallback(
    (id: string) => {
      if (retryLock.current) return;
      retryLock.current = true;
      cancel.reset();
      retry.mutate(
        { id, clientRequestId: crypto.randomUUID() },
        {
          onSettled: () => {
            retryLock.current = false;
          },
        },
      );
    },
    [cancel, retry],
  );
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
  useChatViewport(viewportRef);
  const latestUserMessage = chat?.messages.findLast(
    (message) => message.role === "user",
  );
  const runs = useMemo(() => {
    const latest = new Map<string, NonNullable<typeof chat>["runs"][number]>();
    for (const run of chat?.runs ?? []) {
      const previous = latest.get(run.input_message_id);
      if (
        !previous ||
        run.created_at > previous.created_at ||
        (run.created_at === previous.created_at && run.id > previous.id)
      )
        latest.set(run.input_message_id, run);
    }
    return latest;
  }, [chat?.runs]);
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
    reply.send.isPending ||
    !chat ||
    (query.isError && !query.isFetchNextPageError);
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
  const onCancel = useCallback(
    (id: string) => {
      retry.reset();
      cancel.mutate(id);
    },
    [cancel, retry],
  );
  const actionError =
    cancel.error && retry.error
      ? cancel.submittedAt > retry.submittedAt
        ? cancel.error
        : retry.error
      : (cancel.error ?? retry.error);
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
            <SkeletonStatus>
              <SkeletonSection label="대화를 불러오는 중">
                <Skeleton className="my-6 h-64" />
              </SkeletonSection>
            </SkeletonStatus>
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
                      name={chat.name}
                      message={message}
                      attachments={attachments}
                      run={run}
                      receipt={run ? receipts.get(run.id) : undefined}
                      proposal={run ? proposals.get(run.id) : undefined}
                      now={now}
                      cancelling={cancel.isPending}
                      retrying={retry.isPending}
                      canRetry={message.id === latestUserMessage?.id}
                      onRetry={onRetry}
                      onCancel={onCancel}
                      choicesDisabled={
                        choiceDisabled ||
                        message.id !== chat.messages.at(-1)?.id
                      }
                      selectedChoice={
                        chat.messages.find(
                          (entry) =>
                            entry.role === "user" &&
                            entry.sequence > message.sequence,
                        )?.text
                      }
                      onChoice={onChoice}
                    />
                  );
                }}
              </ChatMessages>
            )}
          </ol>
          {actionError && (
            <Text as="p" role="alert" className="py-3 text-error-text">
              {actionError.message}
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
          reply={reply}
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
      /* Opaque on mobile: the iOS keyboard bar is translucent and sits below the panel. */
      overlayClassName="max-md:bg-background md:bg-transparent"
      className="max-md:top-[var(--chat-viewport-top,0px)] max-md:h-[var(--chat-viewport-height,100dvh)]"
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
