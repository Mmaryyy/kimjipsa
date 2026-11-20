import { request } from "@/shared/api";
import type { TodoCommand } from "../model/todo.schema";
import type { TodoList } from "./type";

const route = "/api/todos";
export const fetchTodos = (signal?: AbortSignal) =>
  request<TodoList>(route, undefined, undefined, signal);
export const writeTodo = (command: TodoCommand) =>
  request<{ id: string }>(route, command);
