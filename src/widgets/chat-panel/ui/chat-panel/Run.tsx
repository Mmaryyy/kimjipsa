import type { Chat, Receipt, ActionProposal } from "@/entities/chat-message";
import { chatErrors } from "@/entities/chat-message";
import { TextButton } from "@/shared/ui";

type Run = Chat["runs"][number];
const states = {
  queued: "요청 대기",
  running: "집사가 처리 중",
  completed: null,
  failed: "처리하지 못했어요",
  cancelled: "요청 취소됨",
  unknown: "결과 확인 필요",
} satisfies Record<Run["status"], string | null>;
interface Props {
  run: Run;
  receipt?: Receipt;
  proposal?: ActionProposal;
  cancelling: boolean;
  now: number;
  onCancel: (id: string) => void;
}
const ChatRun = ({
  run,
  receipt,
  proposal,
  cancelling,
  now,
  onCancel,
}: Props) => {
  const active = run.status === "queued" || run.status === "running";
  const confirming =
    (receipt?.status === "draft" && Date.parse(receipt.expires_at) > now) ||
    (proposal?.status === "draft" && Date.parse(proposal.expires_at) > now);
  const label = confirming ? "내용 확인 대기" : states[run.status];
  const error =
    (run.status === "failed" || run.status === "unknown") && run.error_code
      ? chatErrors[run.error_code]
      : undefined;
  if (!label) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="요청 진행 상태"
      className="flex items-center justify-end"
    >
      <div className="flex items-center gap-2 rounded-full bg-muted p-2 text-caption-sm text-muted-foreground">
        <span
          className={run.status === "failed" ? "text-error-text" : undefined}
        >
          {label}
          {error && <span className="ml-2">{error}</span>}
        </span>
        {active && (
          <TextButton
            size="sm"
            className="text-caption-sm min-h-0!"
            disabled={cancelling}
            onClick={() => onCancel(run.id)}
          >
            요청 취소
          </TextButton>
        )}
      </div>
    </div>
  );
};
export default ChatRun;
