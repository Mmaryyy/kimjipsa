import { tz } from "@date-fns/tz";
import { format } from "date-fns";
import { Fragment, useState, type ReactNode } from "react";
import type { Chat } from "@/entities/chat-message";
import { Message, MessageContent } from "@/shared/ui";
import { chatFaqs } from "../../config/chat.constants";
import ChatBotMessage from "./BotMessage";
import ChatWelcome from "./Welcome";

const ChatDateSeparator = ({ date }: { date: string }) => (
  <li
    role="separator"
    aria-label={date}
    className="flex items-center gap-3 text-caption-sm text-muted-foreground"
  >
    <span aria-hidden="true" className="h-px flex-1 bg-[var(--separator)]" />
    <span>{date}</span>
    <span aria-hidden="true" className="h-px flex-1 bg-[var(--separator)]" />
  </li>
);

interface Props {
  name: string;
  displayName: string;
  messages: Chat["messages"];
  children: (message: Chat["messages"][number]) => ReactNode;
}
const ChatMessages = ({ name, displayName, messages, children }: Props) => {
  const firstDate = format(
    messages[0] ? new Date(messages[0].created_at) : new Date(),
    "yyyy년 M월 d일",
    { in: tz("Asia/Seoul") },
  );
  const [replies, setReplies] = useState<
    { faqIndex: number; afterId: string | null }[]
  >([]);
  const renderReplies = (afterId: string | null) =>
    replies.map((reply, index) => {
      if (reply.afterId !== afterId) return null;
      const faq = chatFaqs[reply.faqIndex];
      return (
        <li key={index} className="space-y-6">
          <Message from="user">
            <MessageContent>
              <span className="sr-only">나</span>
              {faq.title}
            </MessageContent>
          </Message>
          <ChatBotMessage name={name}>{faq.answer}</ChatBotMessage>
        </li>
      );
    });
  return (
    <>
      <ChatDateSeparator date={firstDate} />
      <ChatWelcome
        name={name}
        displayName={displayName}
        onFaq={(faqIndex) =>
          setReplies((current) => [
            ...current,
            { faqIndex, afterId: messages.at(-1)?.id ?? null },
          ])
        }
      />
      {renderReplies(null)}
      {messages.map((message, index) => {
        const date = format(new Date(message.created_at), "yyyy년 M월 d일", {
          in: tz("Asia/Seoul"),
        });
        const previous = messages[index - 1];
        const previousDate = previous
          ? format(new Date(previous.created_at), "yyyy년 M월 d일", {
              in: tz("Asia/Seoul"),
            })
          : firstDate;
        return (
          <Fragment key={message.id}>
            {date !== previousDate && <ChatDateSeparator date={date} />}
            {children(message)}
            {renderReplies(message.id)}
          </Fragment>
        );
      })}
    </>
  );
};
export default ChatMessages;
