import Link from "next/link";
import { ArrowLeft, Settings2 } from "lucide-react";
import { accountRoutes, settingsPath } from "@/shared/config";
import { Button, SegmentedControl, StatusBadge, Text } from "@/shared/ui";

import type { ChatVisibility } from "@/entities/chat-message";
const visibilityOptions = [
  { value: "shared", label: "가족 공용" },
  { value: "private", label: "나만 보기" },
] as const;
interface Props {
  visibility: ChatVisibility;
  onVisibilityChange: (value: ChatVisibility) => void;
  name: string;
  online?: boolean;
  failed: boolean;
}
const ChatHeader = ({
  name,
  online,
  failed,
  visibility,
  onVisibilityChange,
}: Props) => {
  const connection = failed
    ? "연결 확인 실패"
    : online === undefined
      ? "연결 확인 중"
      : online
        ? "맥미니 연결됨"
        : "맥미니 연결 대기";
  return (
    <header className="shrink-0 space-y-3 bg-background px-4 pt-[max(var(--sp-8),env(safe-area-inset-top))] pb-4">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="gray" size="sm">
          <Link href={accountRoutes.home}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            오늘
          </Link>
        </Button>
        <Button asChild variant="gray" size="sm">
          <Link href={settingsPath} aria-label="AI 집사 설정">
            <Settings2 className="size-4" aria-hidden="true" />
            설정
          </Link>
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Text as="h1" variant="title-sm">
            김{name}
          </Text>
          <Text as="p" variant="caption" className="text-muted-foreground">
            {visibility === "private"
              ? "나만 보는 대화 · 가족 기억에 저장하지 않아요"
              : "가족이 함께 보는 집사 대화"}
          </Text>
        </div>
        <div role="status" aria-live="polite">
          <StatusBadge
            variant={failed ? "error" : online ? "success" : "warning"}
          >
            {connection}
          </StatusBadge>
        </div>
      </div>
      <SegmentedControl
        label="대화 공개 범위"
        options={visibilityOptions}
        value={visibility}
        onValueChange={onVisibilityChange}
      />
    </header>
  );
};
export default ChatHeader;
