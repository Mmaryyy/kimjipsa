"use client";
import { useCallback, useState } from "react";
import { type ActionProposal, useChatActions } from "@/entities/chat-message";
import { Button, Checkbox, Text } from "@/shared/ui";
interface Props {
  proposal: ActionProposal;
  now: number;
}
const ChatActionProposal = ({ proposal, now }: Props) => {
  const [selected, setSelected] = useState(
    proposal.actions.map((_, index) => index),
  );
  const { actions } = useChatActions();
  const editable =
    proposal.status === "draft" && Date.parse(proposal.expires_at) > now;
  const remainingSeconds = Math.min(
    300,
    Math.max(0, Math.ceil((Date.parse(proposal.expires_at) - now) / 1000)),
  );
  const remainingTime = `${Math.floor(remainingSeconds / 60)}:${String(
    remainingSeconds % 60,
  ).padStart(2, "0")}`;
  let title = "확인 시간이 지났어요";
  if (editable) title = "이렇게 변경할까요?";
  if (proposal.status === "applied") title = "선택한 변경을 반영했어요";
  if (proposal.status === "cancelled") title = "제안을 취소했어요";
  const shownActions =
    proposal.status === "applied" ? (proposal.result ?? []) : proposal.actions;
  const onConfirm = useCallback(
    () =>
      actions.mutate({ id: proposal.id, version: proposal.version, selected }),
    [actions, proposal.id, proposal.version, selected],
  );
  const onCancel = useCallback(
    () =>
      actions.mutate({
        id: proposal.id,
        version: proposal.version,
        selected: [],
        cancel: true,
      }),
    [actions, proposal.id, proposal.version],
  );
  return (
    <section aria-label="집사 변경 제안" className="space-y-3 py-4">
      <Text as="h3" variant="label">
        {title}
      </Text>
      <ul className="space-y-3">
        {shownActions.map((action, index) => (
          <li key={index} className="flex items-start gap-3">
            {proposal.status !== "applied" && (
              <Checkbox
                aria-label={action.label}
                disabled={!editable || actions.isPending}
                checked={selected.includes(index)}
                onCheckedChange={(checked) =>
                  setSelected((current) =>
                    checked
                      ? [...current, index]
                      : current.filter((value) => value !== index),
                  )
                }
              />
            )}
            <Text variant="body-sm" className="leading-[1.55]">
              {action.label}
            </Text>
          </li>
        ))}
      </ul>
      {editable && (
        <>
          <Text as="p" variant="caption-sm" className="text-muted-foreground">
            선택한 변경만 실행해요. 남은 시간 {remainingTime}
          </Text>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="text-body-sm"
              data-od-id="pending-confirm"
              disabled={actions.isPending || !selected.length}
              onClick={onConfirm}
            >
              선택한 변경 실행
            </Button>
            <Button
              size="sm"
              className="text-body-sm"
              variant="gray"
              data-od-id="pending-cancel"
              disabled={actions.isPending}
              onClick={onCancel}
            >
              취소
            </Button>
          </div>
        </>
      )}
      {actions.error && (
        <Text as="p" variant="caption" role="alert" className="text-error-text">
          {actions.error.message}
        </Text>
      )}
    </section>
  );
};
export default ChatActionProposal;
