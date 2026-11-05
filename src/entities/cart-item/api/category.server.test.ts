import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/shared/api";
vi.mock("server-only", () => ({}));
vi.mock("node:timers/promises", () => ({
  setTimeout: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
}));
vi.mock("@/shared/server", () => ({
  throwDatabaseError: (error: unknown) => {
    if (error) throw error;
  },
}));
import { addWithCategory, categoryWaitMs } from "./category.server";

const categoryId = "10000000-0000-4000-8000-000000000001";
const jobId = "10000000-0000-4000-8000-000000000002";
const command = {
  action: "add" as const,
  duplicate: "ask" as const,
  autoCategory: true,
  item: {
    name: "두부",
    quantity: 1,
    unit_id: null,
    category_id: null,
    memo: "",
    link_url: "",
    inventory_item_id: null,
  },
};
function setup(prepare: object, status: object = prepare) {
  const rpc = vi.fn((_name, { operation }) => {
    const response = Promise.resolve({
      data:
        operation === "prepare"
          ? prepare
          : operation === "status"
            ? status
            : { item: { name: "두부" } },
      error: null,
    });
    return Object.assign(response, { abortSignal: () => response });
  });
  return { rpc, client: { rpc } as unknown as SupabaseClient<Database> };
}
afterEach(() => vi.useRealTimers());
describe("CART-01 SCN-CART-1 카테고리 추천 대기", () => {
  it("재고·구매 이름이 맞으면 AI를 기다리지 않고 해당 카테고리로 담아요", async () => {
    const { rpc, client } = setup({ id: null, categoryId, pending: false });
    await addWithCategory(client, command);
    expect(rpc.mock.calls.map((call) => call[1].operation)).toEqual([
      "prepare",
      "add",
    ]);
    expect(rpc).toHaveBeenCalledWith("cart_category_command", {
      operation: "add",
      input: { id: null, categoryId, command },
    });
  });
  it("중복 응답이면 항목 연결이나 추천 상태를 기다리지 않아요", async () => {
    const { rpc, client } = setup({ id: null, categoryId, pending: false });
    rpc.mockImplementationOnce(
      () =>
        Promise.resolve({
          data: { id: null, categoryId, pending: false },
          error: null,
        }) as ReturnType<typeof rpc>,
    );
    rpc.mockImplementationOnce(
      () =>
        Promise.resolve({
          data: { duplicate: { name: "두부" } },
          error: null,
        }) as ReturnType<typeof rpc>,
    );
    await expect(addWithCategory(client, command)).resolves.toMatchObject({
      duplicate: { name: "두부" },
    });
    expect(rpc.mock.calls.map((call) => call[1].operation)).toEqual([
      "prepare",
      "add",
    ]);
  });
  it("제한 시간 안 AI 답이 오면 그 요청으로 담아요", async () => {
    vi.useFakeTimers();
    const { rpc, client } = setup(
      { id: jobId, categoryId: null, pending: true },
      { id: jobId, categoryId, pending: false },
    );
    const adding = addWithCategory(client, command);
    await vi.advanceTimersByTimeAsync(150);
    await expect(adding).resolves.toMatchObject({
      item: { name: "두부", category_id: categoryId },
    });
    expect(rpc.mock.calls.map((call) => call[1].operation)).toEqual([
      "prepare",
      "add",
      "status",
    ]);
    expect(rpc).toHaveBeenCalledWith("cart_category_command", {
      operation: "add",
      input: { id: jobId, categoryId: null, command },
    });
  });
  it("시간 초과에는 요청을 취소하지 않고 기타로 담을 요청을 보내요", async () => {
    vi.useFakeTimers();
    const { rpc, client } = setup({
      id: jobId,
      categoryId: null,
      pending: true,
    });
    const adding = addWithCategory(client, command);
    await vi.advanceTimersByTimeAsync(categoryWaitMs);
    await adding;
    expect(rpc).toHaveBeenCalledWith("cart_category_command", {
      operation: "add",
      input: { id: jobId, categoryId: null, command },
    });
    expect(rpc.mock.calls.some((call) => call[1].operation === "fail")).toBe(
      false,
    );
  });
  it("게이트웨이 꺼짐은 대기 없이 담고 영속 요청은 남겨요", async () => {
    const { rpc, client } = setup({
      id: jobId,
      categoryId: null,
      pending: false,
    });
    await addWithCategory(client, command);
    expect(rpc.mock.calls.map((call) => call[1].operation)).toEqual([
      "prepare",
      "add",
    ]);
  });
  it("키 없음·추천 실패도 추가를 막지 않아요", async () => {
    vi.useFakeTimers();
    const { rpc, client } = setup(
      { id: jobId, categoryId: null, pending: true },
      { id: jobId, categoryId: null, pending: false },
    );
    const adding = addWithCategory(client, command);
    await vi.advanceTimersByTimeAsync(150);
    await adding;
    expect(rpc).toHaveBeenCalledWith("cart_category_command", {
      operation: "add",
      input: { id: jobId, categoryId: null, command },
    });
  });
});
