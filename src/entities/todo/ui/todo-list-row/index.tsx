import { useState } from "react";
import { LockKeyhole, Pencil, Trash2 } from "lucide-react";
import {
  Button,
  Checkbox,
  ListRow,
  SwipeActionRow,
  Text,
  TextButton,
} from "@/shared/ui";
import type { Todo } from "../../model/todo.schema";
import { todoListRowStyles } from "./todo-list-row.variants";

export type TodoActions = {
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
  onToggle: (todo: Todo, done: boolean) => void;
};

export default function TodoListRow({
  todo,
  overdueDays,
  disabled,
  onEdit,
  onDelete,
  onToggle,
}: TodoActions & {
  todo: Todo;
  overdueDays: number | null;
  disabled: boolean;
}) {
  const completed = !!todo.completed_at;
  const [open, setOpen] = useState(false);
  return (
    <SwipeActionRow
      label={`${todo.title} 동작`}
      disabled={disabled}
      open={open}
      onOpenChange={setOpen}
      actions={[
        <Button
          key="edit"
          size="icon-sm"
          variant="gray"
          aria-label={`${todo.title} 수정`}
          disabled={disabled}
          onClick={() => {
            setOpen(false);
            onEdit(todo);
          }}
        >
          <Pencil size={16} aria-hidden />
        </Button>,
        <Button
          key="delete"
          size="icon-sm"
          variant="danger"
          aria-label={`${todo.title} 삭제`}
          disabled={disabled}
          onClick={() => {
            setOpen(false);
            onDelete(todo);
          }}
        >
          <Trash2 size={16} aria-hidden />
        </Button>,
      ]}
      data-od-id="todo-row"
    >
      {(contentDisabled) => (
        <ListRow
          as="div"
          className={todoListRowStyles.row}
          leading={
            <Checkbox
              checked={completed}
              disabled={contentDisabled}
              aria-label={`${todo.title} 완료`}
              onCheckedChange={(checked) => onToggle(todo, checked === true)}
              className={todoListRowStyles.checkbox}
            />
          }
          trailing={
            overdueDays !== null && (
              <Text variant="caption" className={todoListRowStyles.overdue}>
                {overdueDays}일째
              </Text>
            )
          }
        >
          <TextButton
            disabled={contentDisabled}
            tone={completed ? "muted" : "neutral"}
            size="touch"
            className={todoListRowStyles.titleButton}
            onClick={() => onEdit(todo)}
          >
            <span className={todoListRowStyles.title({ completed })}>
              {todo.title}
            </span>
            {todo.visibility === "private" && (
              <LockKeyhole
                size={16}
                aria-hidden
                className={todoListRowStyles.privacyIcon}
              />
            )}
          </TextButton>
          {todo.visibility === "private" && (
            <span className="sr-only">개인 할 일</span>
          )}
        </ListRow>
      )}
    </SwipeActionRow>
  );
}
