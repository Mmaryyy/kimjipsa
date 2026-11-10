"use client";
import { useState } from "react";
import { type ActionProposal, useChatActions } from "@/entities/chat-message";
import { cn } from "@/shared/lib";
import { Button, Text, TextButton } from "@/shared/ui";
import ChatProposalForm from "./ProposalForm";
interface Props {
  proposal: ActionProposal;
  now: number;
}
const ChatActionProposal = ({ proposal }: Props) => {
  const [selected, setSelected] = useState(
    proposal.actions.map((_, index) => index),
  );
  const [editing, setEditing] = useState(false);
  const { actions } = useChatActions();
  const editable = proposal.status === "draft";
  const shownActions = proposal.actions;
  if (editing && editable)
    return (
      <ChatProposalForm
        actions={proposal.actions}
        pending={actions.isPending}
        error={actions.error?.message}
        onClose={() => setEditing(false)}
        onSave={(updated) =>
          actions.mutate(
            {
              id: proposal.id,
              version: proposal.version,
              selected,
              actions: updated,
            },
            { onSuccess: () => setEditing(false) },
          )
        }
      />
    );
  return (
    <section aria-label="집사 변경 제안" className="space-y-3 py-2">
      {proposal.status === "cancelled" ? (
        <Text as="p" variant="body-sm">
          요청 처리를 취소했어요.
        </Text>
      ) : (
        <>
          {shownActions.length > 1 && (
            <Text as="h3" variant="label">
              이렇게 반영할까요?
            </Text>
          )}
          <ul className="space-y-2">
            {shownActions.map((action, index) => {
              const included = selected.includes(index);
              const toggleLabel = included ? "빼기" : "되돌리기";
              return (
                <li
                  key={index}
                  className="flex items-start justify-between gap-2"
                >
                  <Text
                    variant="body-sm"
                    className={cn(
                      "min-w-0 break-words leading-[1.55]",
                      editable && !included && "opacity-40",
                    )}
                  >
                    {action.label}
                  </Text>
                  {editable && proposal.actions.length > 1 && (
                    <TextButton
                      size="sm"
                      className="shrink-0 text-caption"
                      aria-label={`${action.label} ${toggleLabel}`}
                      disabled={actions.isPending}
                      onClick={() =>
                        setSelected((current) =>
                          included
                            ? current.filter((value) => value !== index)
                            : [...current, index],
                        )
                      }
                    >
                      {toggleLabel}
                    </TextButton>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {proposal.status === "applied" && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" data-od-id="pending-confirm" disabled aria-pressed>
            확인
          </Button>
        </div>
      )}
      {editable && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            data-od-id="pending-confirm"
            disabled={actions.isPending || !selected.length}
            onClick={() =>
              actions.mutate({
                id: proposal.id,
                version: proposal.version,
                selected,
              })
            }
          >
            확인
          </Button>
          <Button
            size="sm"
            variant="gray"
            data-od-id="pending-edit"
            disabled={actions.isPending}
            onClick={() => setEditing(true)}
          >
            수정
          </Button>
          <Button
            size="sm"
            variant="gray"
            data-od-id="pending-cancel"
            disabled={actions.isPending}
            onClick={() =>
              actions.mutate({
                id: proposal.id,
                version: proposal.version,
                selected: [],
                cancel: true,
              })
            }
          >
            취소
          </Button>
        </div>
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
