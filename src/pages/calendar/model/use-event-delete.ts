"use client";
import type { CalendarEvent } from "@/entities/event";
import { useConfirm } from "@/shared/ui";
import { useEventEditor } from "./use-event-editor";

export function useEventDelete(
  event: CalendarEvent | null | undefined,
  onClose: () => void,
) {
  const confirm = useConfirm();
  const { onDelete, deleteError } = useEventEditor(event?.id, onClose);
  const remove = () =>
    confirm({
      targetName: event?.details?.title,
      title: "일정을 삭제할까요?",
      description: "삭제한 일정은 되돌릴 수 없어요.",
      confirmLabel: event?.recurrence ? "이후 모든 일정" : "삭제",
      onConfirm: () => onDelete(event?.recurrence ? "following" : undefined),
      secondaryAction: event?.recurrence
        ? { label: "이 일정만", onClick: () => onDelete("single") }
        : undefined,
    });
  return { remove, deleteError };
}
