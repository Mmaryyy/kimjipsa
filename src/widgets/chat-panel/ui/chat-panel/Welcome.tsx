import { chatCapabilities } from "@/entities/chat-message";
import { Text, TextButton } from "@/shared/ui";
import { chatFaqs } from "../../config/chat.constants";
import ChatBotMessage from "./BotMessage";

interface Props {
  name: string;
  displayName: string;
  onFaq: (index: number) => void;
}
const ChatWelcome = ({ name, displayName, onFaq }: Props) => (
  <li data-od-id="chat-greeting">
    <ChatBotMessage name={name}>
      <Text as="p" variant="body-sm">
        안녕하세요, {displayName}님. 김{name}예요. 이런 일을 도와드릴 수 있어요.
      </Text>
      <ul className="mt-1.5 [&>li]:py-0.5 [&>li]:before:text-[var(--label-tertiary)] [&>li]:before:content-['–_']">
        {chatCapabilities.map((capability) => (
          <li key={capability}>{capability}</li>
        ))}
      </ul>
      <div className="mt-2 flex flex-col items-start">
        {chatFaqs.map((faq, index) => (
          <TextButton
            key={faq.title}
            className="min-h-8 justify-start p-0 text-left text-body-sm font-normal text-[var(--link)]"
            onClick={() => onFaq(index)}
            data-od-id={`faq-${index + 1}`}
          >
            {faq.title}
          </TextButton>
        ))}
      </div>
    </ChatBotMessage>
  </li>
);
export default ChatWelcome;
