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
      <Text as="h3" variant="headline">
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
            <Text>{action.label}</Text>
          </li>
        ))}
      </ul>
      {editable && (
        <>
          <Text as="p" variant="caption" className="text-muted-foreground">
            선택한 변경만 실행해요. 5분이 지나면 만료돼요.
          </Text>
          <div className="flex gap-2">
            <Button
              disabled={actions.isPending || !selected.length}
              onClick={onConfirm}
            >
              선택한 변경 실행
            </Button>
            <Button
              variant="gray"
              disabled={actions.isPending}
              onClick={onCancel}
            >
              취소
            </Button>
          </div>
        </>
      )}
      {actions.error && (
        <Text as="p" role="alert" className="text-error-text">
          {actions.error.message}
        </Text>
      )}
    </section>
  );
};
export default ChatActionProposal;
