// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type * as SharedServer from "@/shared/server";
import { todosGET, todosPOST } from "./todo-routes";

const mock = vi.hoisted(() => ({
  stage: "ready",
  perspective: 0,
  values: new Map<string, unknown>(),
}));
const family = {
  id: "10000000-0000-4000-8000-000000000001",
  members: [
    { user_id: "10000000-0000-4000-8000-000000000002" },
    { user_id: "10000000-0000-4000-8000-000000000003" },
  ],
};

vi.mock("server-only", () => ({}));
vi.mock("@/shared/server", async (original) => ({
  ...(await original<typeof SharedServer>()),
  mockContext: async () => mock,
  mockJson: async () => family,
}));

const origin = "http://localhost";
const url = `${origin}/api/todos`;
const read = async () => (await todosGET(new Request(url))).json();
const write = (body: unknown) =>
  todosPOST(
    new Request(url, {
      method: "POST",
      headers: { origin },
      body: JSON.stringify(body),
    }),
  );

describe("CAL-18 / SCN-CAL-11 할 일 API", () => {
  it("배우자 응답에서 개인 행을 빼고 공유 완료 상태를 반영해요", async () => {
    const item = { title: "반품 보내기", due_on: null, visibility: "shared" };
    const response = await write({ action: "save", item });
    const {
      data: { id },
    } = await response.json();
    const privateResponse = await write({
      action: "save",
      item: { ...item, title: "개인 제목", visibility: "private" },
    });
    const {
      data: { id: privateId },
    } = await privateResponse.json();

    mock.perspective = 1;
    expect(await read()).toMatchObject({
      ok: true,
      data: {
        items: expect.arrayContaining([expect.objectContaining({ id })]),
      },
    });
    const spouseBody = JSON.stringify(await read());
    expect(spouseBody).not.toContain(privateId);
    expect(spouseBody).not.toContain("개인 제목");
    expect(
      (await write({ action: "set_done", id: privateId, done: true })).status,
    ).toBe(404);
    expect(
      (
        await write({
          action: "save",
          id,
          item: { ...item, visibility: "private" },
        })
      ).status,
    ).toBe(403);
    expect((await write({ action: "set_done", id, done: true })).status).toBe(
      200,
    );

    mock.perspective = 0;
    expect(await read()).toMatchObject({
      ok: true,
      data: {
        items: expect.arrayContaining([
          expect.objectContaining({
            id,
            completed_by: family.members[1].user_id,
          }),
        ]),
      },
    });
  });
});
