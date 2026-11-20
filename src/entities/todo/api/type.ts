import type { Todo } from "../model/todo.schema";

export type TodoList = {
  items: Todo[];
  userId: string;
  familyId: string;
};
