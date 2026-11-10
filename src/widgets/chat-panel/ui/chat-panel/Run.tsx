import type { Chat } from "@/entities/chat-message";
import { chatErrors } from "@/entities/chat-message";
import { chatCancelDelayMs } from "../../config/chat.constants";
import ChatTime from "./Time";
import { TextButton } from "@/shared/ui";

type Run = Chat["runs"][number];
const states = {
  queued: "전송됨",
  running: "방금 읽음",
  completed: null,
  failed: "처리하지 못했어요",
  cancelled: "요청 취소됨",
  unknown: "결과 확인 필요",
} satisfies Record<Run["status"], string | null>;
interface Props {
  run: Run;
  cancelling: boolean;
  retrying: boolean;
  canRetry: boolean;
  onRetry: (id: string) => void;
  now: number;
  onCancel: (id: string) => void;
}
export const ChatRunCaption = ({
  run,
  createdAt,
}: {
  run?: Run;
  createdAt: string;
}) => (
  <span className="float-right mt-1 ml-2 inline-block whitespace-nowrap text-caption-sm text-muted-foreground">
    {run && states[run.status] && (
      <span aria-label="요청 진행 상태">{states[run.status]} · </span>
    )}
    <ChatTime value={createdAt} />
  </span>
);
const ChatRun = ({
  run,
  cancelling,
  retrying,
  canRetry,
  onRetry,
  now,
  onCancel,
}: Props) => {
  const active = run.status === "queued" || run.status === "running";
  const retryable =
    canRetry && ["cancelled", "failed", "unknown"].includes(run.status);
  const canCancel =
    active && now - Date.parse(run.created_at) >= chatCancelDelayMs;
  const error =
    run.status === "failed" && run.error_code
      ? chatErrors[run.error_code]
      : undefined;
  if (!error && !canCancel && !retryable) return null;
  return (
    <div className="flex justify-end text-right">
      <div className="flex flex-wrap items-center justify-end gap-x-2 text-caption-sm text-muted-foreground">
        {error && <span className="text-error-text">{error}</span>}
        {canCancel && (
          <TextButton
            size="sm"
            className="text-caption-sm"
            disabled={cancelling}
            onClick={() => onCancel(run.id)}
          >
            요청 취소
          </TextButton>
        )}
        {retryable && (
          <TextButton
            size="sm"
            className="text-caption-sm"
            disabled={retrying}
            onClick={() => onRetry(run.id)}
          >
            재시도
          </TextButton>
        )}
      </div>
    </div>
  );
};
export default ChatRun;
