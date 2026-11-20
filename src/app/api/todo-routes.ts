import "server-only";
import { listTodos, changeTodo } from "@/entities/todo/index.server";
import { handleRoute, readJson } from "@/shared/server";

export const todosGET = (request: Request) => handleRoute(request, listTodos);
export const todosPOST = (request: Request) =>
  handleRoute(request, async () => changeTodo(await readJson(request)));
