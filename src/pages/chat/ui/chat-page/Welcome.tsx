import Image from "next/image";
import { EmptyState, Text } from "@/shared/ui";
import { chatFaqs } from "../../config/chat.constants";

const ChatWelcome = () => (
  <div className="space-y-6 py-6">
    <EmptyState
      message="우리 집 일을 함께 챙겨요"
      icon={
        <Image
          src="/images/kimjipsa-dog-bird.png"
          width={96}
          height={96}
          alt=""
          className="object-contain"
        />
      }
    />
    <Text as="p" className="text-center text-muted-foreground">
      재고를 물어보거나 영수증 사진을 보내 주세요.
    </Text>
    <div className="space-y-3">
      {chatFaqs.map((faq) => (
        <details key={faq.title} className="group">
          <summary className="min-h-hit cursor-pointer py-2 text-label">
            {faq.title}
          </summary>
          <Text as="p" variant="body-sm" className="pb-3 text-muted-foreground">
            {faq.answer}
          </Text>
        </details>
      ))}
    </div>
  </div>
);
export default ChatWelcome;
