import { Badge, Button, StatusBadge, Text } from "@/shared/ui";
import { ChevronDown, X } from "lucide-react";

import Image from "next/image";
import { cn } from "@/shared/lib";
import { useChatNavigation } from "@/features/chat-navigation";

interface Props {
  name: string;
  online?: boolean;
  failed: boolean;
}
const ChatHeader = ({ name, online, failed }: Props) => {
  const { onClose, onMinimize } = useChatNavigation();
  const connection =
    failed || online === false
      ? "끊김(맥미니)"
      : online === undefined
        ? "확인 중(맥미니)"
        : "연결됨(맥미니)";
  return (
    <header className="shrink-0 space-y-3 bg-background px-4 pt-[max(var(--sp-2),env(safe-area-inset-top))] pb-4">
      <div className="flex items-center gap-2">
        <Image
          src="/images/kimjipsa-avatar.png"
          alt=""
          width={52}
          height={52}
          className={cn(
            "size-13 shrink-0 rounded-full bg-[var(--bot-avatar-bg)]",
            "p-[calc(var(--sp-2)-var(--sp-1)/4)] object-contain",
          )}
        />
        <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
          <Text as="h1" variant="body" className="font-semibold">
            김{name}
          </Text>
          <Badge>
            <StatusBadge
              variant={
                failed || online === false
                  ? "error"
                  : online
                    ? "success"
                    : "warning"
              }
              className="text-inherit [font-size:inherit]"
            >
              {connection}
            </StatusBadge>
          </Badge>
        </div>
        <Button
          variant="gray"
          className="bg-transparent text-primary!"
          size="icon"
          aria-label="최소화"
          data-od-id="chat-minimize"
          onClick={onMinimize}
        >
          <ChevronDown aria-hidden="true" />
        </Button>
        <Button
          variant="gray"
          className="bg-transparent text-primary!"
          size="icon"
          aria-label="닫기"
          data-od-id="chat-close"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
    </header>
  );
};
export default ChatHeader;
