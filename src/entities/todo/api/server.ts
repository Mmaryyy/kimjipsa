import "server-only";
import { z } from "zod";
import { ApiError } from "@/shared/api";
import {
  createServerSupabaseClient,
  mockContext,
  mockJson,
  throwDatabaseError,
} from "@/shared/server";
import { todoCommand, todoRow } from "../model/todo.schema";
import { todoMock, writeTodoMock } from "./mock.server";
import type { TodoList } from "./type";

const errors = {
  unauthorized: [401, "로그인이 필요해요."],
  family_required: [403, "가정에 먼저 참여해 주세요."],
  todo_not_found: [404, "할 일을 찾을 수 없어요."],
  todo_forbidden: [403, "작성자만 개인 할 일로 바꿀 수 있어요."],
  invalid_todo: [400, "할 일 내용을 확인해 주세요."],
} as const;

async function todoContext() {
  const mock = await mockContext();
  if (mock) {
    const stage = mock.values.get("account-stage") ?? mock.stage;
    if (stage === "login")
      throw new ApiError("unauthorized", errors.unauthorized[1], 401);
    if (stage === "profile" || stage === "family")
      throw new ApiError("family_required", errors.family_required[1], 403);
    const family = await mockJson("family");
    return {
      mock: todoMock(
        mock.values,
        family.members.map((member) => member.user_id),
      ),
      familyId: family.id,
      userId: family.members[mock.perspective]!.user_id,
    };
  }

  const client = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    throw new ApiError("unauthorized", errors.unauthorized[1], 401);
  const membership = await client
    .from("memberships")
    .select("family_id")
    .eq("user_id", user.id)
    .maybeSingle();
  throwDatabaseError(membership.error, errors);
  if (!membership.data)
    throw new ApiError("family_required", errors.family_required[1], 403);
  return { client, familyId: membership.data.family_id, userId: user.id };
}

export async function listTodos(): Promise<TodoList> {
  const { client, mock, userId, familyId } = await todoContext();
  if (mock) {
    const items = mock.items.filter(
      (todo) => todo.visibility === "shared" || todo.owner_id === userId,
    );
    return { items, familyId, userId };
  }

  const items: TodoList["items"] = [];
  const pageSize = 500;
  let after: string | undefined;
  for (;;) {
    const query = client
      .from("todos")
      .select(
        "id, title, due_on, visibility, owner_id, completed_at, completed_by, created_at, updated_at",
      )
      .eq("family_id", familyId)
      .or(`visibility.eq.shared,owner_id.eq.${userId}`)
      .order("id")
      .limit(pageSize);
    if (after) query.gt("id", after);
    const { data, error } = await query;
    throwDatabaseError(error, errors);
    const rows = z.array(todoRow).parse(data);
    items.push(...rows);
    if (rows.length < pageSize) return { items, familyId, userId };
    after = rows.at(-1)?.id;
  }
}

export async function changeTodo(body: unknown) {
  const command = todoCommand.parse(body);
  const { client, mock, userId } = await todoContext();
  if (mock) return { id: writeTodoMock(mock, command, userId) };
  const { data, error } = await client.rpc("write_todo", { payload: command });
  throwDatabaseError(error, errors);
  return { id: z.uuid().parse(data) };
}
