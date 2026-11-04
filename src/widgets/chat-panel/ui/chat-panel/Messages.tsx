import { useState, type ReactNode } from "react";
import { Message, MessageContent } from "@/shared/ui";
import { chatFaqs } from "../../config/chat.constants";
import ChatBotMessage from "./BotMessage";
import ChatWelcome from "./Welcome";

interface Props {
  name: string;
  displayName: string;
  children: ReactNode;
}
const ChatMessages = ({ name, displayName, children }: Props) => {
  const [replies, setReplies] = useState<number[]>([]);
  return (
    <>
      <ChatWelcome
        name={name}
        displayName={displayName}
        onFaq={(index) => setReplies((current) => [...current, index])}
      />
      {children}
      {replies.map((faqIndex, index) => {
        const faq = chatFaqs[faqIndex];
        return (
          <li key={index} className="space-y-6">
            <Message from="user">
              <MessageContent>{faq.title}</MessageContent>
            </Message>
            <ChatBotMessage name={name}>{faq.answer}</ChatBotMessage>
          </li>
        );
      })}
    </>
  );
};
export default ChatMessages;
