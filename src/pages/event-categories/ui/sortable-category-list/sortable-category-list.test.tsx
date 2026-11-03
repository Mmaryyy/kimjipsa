import type { ComponentProps } from "react";
import type * as DndModule from "@dnd-kit/core";
import type * as EventModule from "@/entities/event";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  categoryQueryKey,
  eventCategoryColors,
  reorderCategory,
  type EventCategory,
} from "@/entities/event";
import { ToastProvider } from "@/shared/ui";
import SortableCategoryList from ".";

// 드래그 센서만 대체하고 저장 훅과 공용 토스트는 그대로 확인해요.
vi.mock("@dnd-kit/core", async (original) => ({
  ...(await original<typeof DndModule>()),
  DndContext: ({
    children,
    onDragStart,
    onDragEnd,
  }: ComponentProps<typeof DndModule.DndContext>) => {
    const active = {
      id: "home",
      data: { current: undefined },
      rect: { current: { initial: null, translated: null } },
    };
    return (
      <>
        <button
          onClick={() => {
            const activatorEvent = new Event("pointerdown");
            onDragStart?.({ active, activatorEvent });
            onDragEnd?.({
              active,
              activatorEvent,
              collisions: null,
              delta: { x: 0, y: 44 },
              over: {
                id: "work",
                data: { current: undefined },
                rect: {
                  top: 44,
                  bottom: 88,
                  left: 0,
                  right: 100,
                  width: 100,
                  height: 44,
                },
                disabled: false,
              },
            });
          }}
        >
          카테고리 옮기기
        </button>
        {children}
      </>
    );
  },
}));

vi.mock("@/entities/event", async (original) => ({
  ...(await original<typeof EventModule>()),
  reorderCategory: vi.fn(),
}));

const color = Object.keys(eventCategoryColors)[0] as EventCategory["color"];
const categories: EventCategory[] = [
  { id: "home", name: "우리집", color, sortOrder: 0 },
  { id: "work", name: "회사", color, sortOrder: 1 },
];

function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  client.setQueryData(categoryQueryKey, categories);
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SortableCategoryList categories={categories} onEdit={vi.fn()} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return client;
}

describe("CAL-08 ACC-13 P4.9 r048-f1 순서 저장 알림", () => {
  beforeEach(() => {
    vi.mocked(reorderCategory).mockReset();
  });

  it("저장이 성공한 뒤에만 토스트를 한 번 보여 줘요", async () => {
    let finishSaving!: (id: string) => void;
    vi.mocked(reorderCategory).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSaving = resolve;
        }),
    );
    setup();
    fireEvent.click(screen.getByRole("button", { name: "카테고리 옮기기" }));
    await waitFor(() => expect(reorderCategory).toHaveBeenCalledOnce());
    expect(screen.queryByText("순서를 저장했어요")).not.toBeInTheDocument();
    finishSaving("home");
    expect(await screen.findByText("순서를 저장했어요")).toBeVisible();
    expect(screen.queryByText("순서를 저장해요.")).not.toBeInTheDocument();
  });

  it("연속 저장에서도 보이는 토스트는 하나예요", async () => {
    vi.mocked(reorderCategory).mockResolvedValue("home");
    const client = setup();
    const moveButton = screen.getByRole("button", { name: "카테고리 옮기기" });
    fireEvent.click(moveButton);
    await screen.findByText("순서를 저장했어요");
    await waitFor(() => expect(client.isMutating()).toBe(0));
    fireEvent.click(moveButton);
    await waitFor(() => expect(reorderCategory).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(client.isMutating()).toBe(0));
    expect(screen.getAllByText("순서를 저장했어요")).toHaveLength(1);
  });

  it("저장에 실패하면 성공 토스트 없이 되돌림 오류를 보여 줘요", async () => {
    vi.mocked(reorderCategory).mockRejectedValue(new Error("연결 실패"));
    const client = setup();
    fireEvent.click(screen.getByRole("button", { name: "카테고리 옮기기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "순서를 저장하지 못해 원래 순서로 되돌렸어요. 연결 실패",
    );
    expect(screen.queryByText("순서를 저장했어요")).not.toBeInTheDocument();
    expect(client.getQueryData(categoryQueryKey)).toEqual(categories);
  });
});
