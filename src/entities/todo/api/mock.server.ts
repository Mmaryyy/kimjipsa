import "server-only";
import { tz } from "@date-fns/tz";
import { subDays } from "date-fns";
import { randomUUID } from "node:crypto";
import { ApiError } from "@/shared/api";
import { todoToday } from "../lib/todo-date.utils";
import type { Todo, TodoCommand, TodoFields } from "../model/todo.schema";

type TodoStore = {
  items: Todo[];
  undo: Map<string, { item: Todo; expiresAt: number }>;
};

function newTodo(item: TodoFields, actor: string): Todo {
  const now = new Date().toISOString();
  return {
    ...item,
    id: randomUUID(),
    owner_id: actor,
    completed_at: null,
    completed_by: null,
    created_at: now,
    updated_at: now,
  };
}

export function todoMock(
  values: Map<string, unknown>,
  members: string[],
): TodoStore {
  const key = "calendar-todos";
  const existing = values.get(key) as TodoStore | undefined;
  if (existing) return existing;
  const actor = members[0];
  const now = new Date();
  const overdueDate = todoToday(subDays(now, 2, { in: tz("Asia/Seoul") }));
  const store: TodoStore = {
    items: [
      newTodo(
        { title: "관리비 내기", due_on: null, visibility: "shared" },
        actor,
      ),
      newTodo(
        { title: "택배 반품", due_on: overdueDate, visibility: "shared" },
        actor,
      ),
      {
        ...newTodo(
          { title: "책 반납", due_on: null, visibility: "private" },
          actor,
        ),
        completed_at: now.toISOString(),
        completed_by: actor,
      },
    ],
    undo: new Map(),
  };
  values.set(key, store);
  return store;
}

export function writeTodoMock(
  store: TodoStore,
  command: TodoCommand,
  actor: string,
) {
  const missing = () =>
    new ApiError("todo_not_found", "할 일을 찾을 수 없어요.", 404);
  if (command.action === "undo") {
    const deleted = store.undo.get(actor);
    if (
      !deleted ||
      deleted.item.id !== command.id ||
      deleted.expiresAt <= Date.now()
    )
      throw missing();
    store.items.push(deleted.item);
    store.undo.delete(actor);
    return command.id;
  }
  if (command.action === "save" && !command.id) {
    const item = newTodo(command.item, actor);
    store.items.push(item);
    return item.id;
  }
  const index = store.items.findIndex(
    (todo) =>
      todo.id === command.id &&
      (todo.visibility === "shared" || todo.owner_id === actor),
  );
  const item = store.items[index];
  if (!item) throw missing();
  const now = new Date().toISOString();
  switch (command.action) {
    case "save":
      if (command.item.visibility === "private" && item.owner_id !== actor)
        throw new ApiError(
          "todo_forbidden",
          "작성자만 개인 할 일로 바꿀 수 있어요.",
          403,
        );
      Object.assign(item, command.item, { updated_at: now });
      break;
    case "set_done":
      if (command.done !== Boolean(item.completed_at)) {
        item.completed_at = command.done ? now : null;
        item.completed_by = command.done ? actor : null;
        item.updated_at = now;
      }
      break;
    case "delete":
      store.items.splice(index, 1);
      store.undo.set(actor, { item, expiresAt: Date.now() + 30_000 });
      break;
  }
  return item.id;
}
