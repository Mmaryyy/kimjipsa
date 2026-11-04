import Link from "next/link";
import { ArrowLeft, Settings2 } from "lucide-react";
import { accountRoutes, settingsPath } from "@/shared/config";
import { Button, StatusBadge, Text } from "@/shared/ui";

interface Props {
  name: string;
  online?: boolean;
  failed: boolean;
}
const ChatHeader = ({ name, online, failed }: Props) => {
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
            나만 보는 대화
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
      <Text as="p" variant="caption" className="text-muted-foreground">
        마지막 메시지 후 1시간이 지나면 대화 기록이 삭제돼요.
      </Text>
    </header>
  );
};
export default ChatHeader;
