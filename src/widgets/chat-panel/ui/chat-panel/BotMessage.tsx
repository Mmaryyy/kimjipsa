import type { ReactNode } from "react";
import { Message, MessageContent } from "@/shared/ui";
import ChatAvatar from "./Avatar";

interface Props {
  name: string;
  children: ReactNode;
}
const ChatBotMessage = ({ name, children }: Props) => (
  <Message from="assistant">
    <div className="grid min-w-0 grid-cols-[48px_minmax(0,1fr)] gap-x-2 gap-y-1">
      <ChatAvatar />
      <div className="sr-only">김{name}</div>
      <MessageContent className="col-start-2 gap-0">{children}</MessageContent>
    </div>
  </Message>
);
export default ChatBotMessage;
