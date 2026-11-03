import { Check, Clock3, LoaderCircle } from "lucide-react";
import { chatErrors, type Chat, type Receipt } from "@/entities/chat-message";
import { cn } from "@/shared/lib";
import { StatusBadge, Text, TextButton, type StatusVariant } from "@/shared/ui";

type Run = Chat["runs"][number];
const states = {
  queued: { label: "요청 대기", tone: "warning" },
  running: { label: "집사가 처리 중", tone: "info" },
  completed: { label: "응답 완료", tone: "success" },
  failed: { label: "처리하지 못했어요", tone: "error" },
  cancelled: { label: "요청 취소됨", tone: "info" },
  unknown: { label: "결과 확인 필요", tone: "warning" },
} satisfies Record<Run["status"], { label: string; tone: StatusVariant }>;
const steps = ["요청 접수", "집사 처리", "응답 완료"];
interface Props {
  run: Run;
  receipt?: Receipt;
  workerOnline: boolean;
  hasPhotos: boolean;
  cancelling: boolean;
  now: number;
  onCancel: (id: string) => void;
}
const ChatRun = ({
  run,
  receipt,
  workerOnline,
  hasPhotos,
  cancelling,
  now,
  onCancel,
}: Props) => {
  const active = run.status === "queued" || run.status === "running";
  const state = states[run.status];
  const confirming =
    receipt?.status === "draft" && Date.parse(receipt.expires_at) > now;
  const step = run.status === "queued" ? 0 : 1;
  let detail = "";
  if (run.status === "queued")
    detail = workerOnline
      ? "앞선 요청이 끝나면 이어서 처리해요."
      : "맥미니에 연결되면 자동으로 시작해요.";
  if (run.status === "running")
    detail = hasPhotos
      ? "사진과 요청 내용을 확인하고 있어요."
      : "우리 집 정보를 확인하고 답변을 준비하고 있어요.";
  if (run.error_code)
    detail =
      chatErrors[run.error_code] ??
      "요청을 처리하지 못했어요. 연결 상태를 확인해 주세요.";
  return (
    <div className="space-y-2 py-2" aria-label="요청 진행 상태">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusBadge variant={confirming ? "warning" : state.tone}>
          {confirming ? "내용 확인 대기" : state.label}
        </StatusBadge>
        {active && (
          <TextButton
            size="sm"
            disabled={cancelling}
            onClick={() => onCancel(run.id)}
          >
            요청 취소
          </TextButton>
        )}
      </div>
      {active && (
        <ol
          className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground"
          aria-label="처리 단계"
        >
          {steps.map((label, index) => {
            const Icon =
              index < step
                ? Check
                : index === step && run.status === "running"
                  ? LoaderCircle
                  : Clock3;
            return (
              <li
                key={label}
                aria-current={index === step ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1",
                  index === step && "text-info-text",
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "size-3",
                    index === step &&
                      run.status === "running" &&
                      "motion-safe:animate-spin",
                  )}
                />
                {label}
              </li>
            );
          })}
        </ol>
      )}
      {detail && (
        <Text as="p" variant="caption" className="text-muted-foreground">
          {detail}
        </Text>
      )}
    </div>
  );
};
export default ChatRun;
