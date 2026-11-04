import { Fragment, useState, type ReactNode } from "react";
import type { Chat } from "@/entities/chat-message";
import { Message, MessageContent } from "@/shared/ui";
import { chatFaqs } from "../../config/chat.constants";
import ChatBotMessage from "./BotMessage";
import ChatWelcome from "./Welcome";

interface Props {
  name: string;
  displayName: string;
  messages: Chat["messages"];
  children: (message: Chat["messages"][number]) => ReactNode;
}
const ChatMessages = ({ name, displayName, messages, children }: Props) => {
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
            <MessageContent>{faq.title}</MessageContent>
          </Message>
          <ChatBotMessage name={name}>{faq.answer}</ChatBotMessage>
        </li>
      );
    });
  return (
    <>
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
      {messages.map((message) => (
        <Fragment key={message.id}>
          {children(message)}
          {renderReplies(message.id)}
        </Fragment>
      ))}
    </>
  );
};
export default ChatMessages;
