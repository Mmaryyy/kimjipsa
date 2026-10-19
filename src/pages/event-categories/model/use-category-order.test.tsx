import type * as EventModule from "@/entities/event";
import type { PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  categoryQueryKey,
  eventCategoryColors,
  reorderCategory,
  type EventCategory,
} from "@/entities/event";
import { moveCategory } from "../lib/category-order.utils";
import { useCategoryOrder } from "./use-category-order";

vi.mock("@/entities/event", async (importOriginal) => ({
  ...(await importOriginal<typeof EventModule>()),
  reorderCategory: vi.fn(),
}));
const color = Object.keys(eventCategoryColors)[0] as EventCategory["color"];
const categories: EventCategory[] = [
  { id: "home", name: "우리집", color, sortOrder: 0 },
  { id: "work", name: "회사", color, sortOrder: 1 },
  { id: "other", name: "기타", color, sortOrder: 2 },
];
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(categoryQueryKey, categories);
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(useCategoryOrder, { wrapper }) };
}

describe("CAL-08 ACC-13 P4.9 일정 카테고리 순서", () => {
  it("p4o-6 아래와 위로 이동하며 기타도 이동할 수 있어요", () => {
    const moved = moveCategory(categories, "home", "other");
    expect(
      moved?.categories.map(({ id, sortOrder }) => [id, sortOrder]),
    ).toEqual([
      ["work", 0],
      ["other", 1],
      ["home", 2],
    ]);
    expect(moveCategory(categories, "other", "home")?.categories[0]?.name).toBe(
      "기타",
    );
    expect(categories[0]?.id).toBe("home");
    expect(moveCategory(categories, "home", "home")).toBeNull();
    expect(moveCategory(categories, "missing", "home")).toBeNull();
  });
  it("p4o-6 키보드 방향키로 정한 인접 위치도 같은 이동 규칙을 써요", () => {
    const down = moveCategory(categories, "home", "work")!;
    expect(down.sortOrder).toBe(1);
    expect(moveCategory(down.categories, "home", "work")?.categories).toEqual(
      categories,
    );
  });
  it("p4o-6 놓은 카테고리만 한 번 저장하고 모든 조회자가 새 순서를 봐요", async () => {
    let resolve!: (id: string) => void;
    vi.mocked(reorderCategory)
      .mockReset()
      .mockImplementation(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
    const { result, client } = setup();
    act(() => {
      result.current.onMove("other", "home");
    });
    await waitFor(() =>
      expect(
        client.getQueryData<EventCategory[]>(categoryQueryKey)?.[0]?.id,
      ).toBe("other"),
    );
    expect(reorderCategory).toHaveBeenCalledExactlyOnceWith(categories[2], 0);
    act(() => {
      result.current.onMove("home", "other");
    });
    expect(reorderCategory).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve("other");
    });
  });
  it("p4o-6 저장에 실패하면 원래 순서와 오류를 돌려줘요", async () => {
    vi.mocked(reorderCategory)
      .mockReset()
      .mockRejectedValue(new Error("연결 실패"));
    const { result, client } = setup();
    act(() => {
      result.current.onMove("home", "other");
    });
    await waitFor(() =>
      expect(result.current.error?.message).toBe("연결 실패"),
    );
    expect(client.getQueryData(categoryQueryKey)).toEqual(categories);
  });
  it("r049-f1 드래그 중 서버 값이 와도 집은 목록 기준으로 이동해요", async () => {
    vi.mocked(reorderCategory).mockReset().mockResolvedValue("other");
    const { result, client } = setup();
    act(() => result.current.onDragStart(categories));
    act(() => {
      client.setQueryData(categoryQueryKey, [...categories].reverse());
    });
    expect(result.current.localCategories).toEqual(categories);
    act(() => result.current.onMove("other", "home"));
    await waitFor(() =>
      expect(reorderCategory).toHaveBeenCalledExactlyOnceWith(categories[2], 0),
    );
    await waitFor(() => expect(result.current.saving).toBe(false));
    expect(result.current.localCategories).toBeNull();
  });
  it("r049-f1 저장 중과 저장 후 재조회 중에도 로컬 순서를 유지해요", async () => {
    let finishSaving!: (id: string) => void;
    let finishRefetch!: () => void;
    vi.mocked(reorderCategory)
      .mockReset()
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            finishSaving = resolve;
          }),
      );
    const { result, client } = setup();
    vi.spyOn(client, "invalidateQueries").mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishRefetch = resolve;
        }),
    );
    act(() => result.current.onDragStart(categories));
    act(() => result.current.onMove("home", "other"));
    await waitFor(() => expect(reorderCategory).toHaveBeenCalledOnce());
    const moved = moveCategory(categories, "home", "other")!.categories;
    act(() => client.setQueryData(categoryQueryKey, categories));
    expect(result.current.localCategories).toEqual(moved);
    await act(async () => {
      finishSaving("home");
    });
    await waitFor(() =>
      expect(client.invalidateQueries).toHaveBeenCalledOnce(),
    );
    expect(result.current.localCategories).toEqual(moved);
    expect(result.current.saving).toBe(true);
    await act(async () => {
      client.setQueryData(categoryQueryKey, moved);
      finishRefetch();
    });
    await waitFor(() => expect(result.current.saving).toBe(false));
    expect(result.current.localCategories).toBeNull();
    expect(client.getQueryData(categoryQueryKey)).toEqual(moved);
  });
  it("r049-f1 드래그를 취소하면 최신 서버 목록을 다시 사용해요", () => {
    const { result, client } = setup();
    const updated = [...categories].reverse();
    act(() => result.current.onDragStart(categories));
    act(() => client.setQueryData(categoryQueryKey, updated));
    expect(result.current.localCategories).toEqual(categories);
    act(() => result.current.onDragCancel());
    expect(result.current.localCategories).toBeNull();
    expect(client.getQueryData(categoryQueryKey)).toEqual(updated);
  });
});
