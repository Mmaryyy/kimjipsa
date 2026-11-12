import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ConfirmTestProvider } from "@/shared/ui/confirm-test-provider";
import type * as EventModule from "@/entities/event";
import { eventCategoryColors } from "@/entities/event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/shared/ui";
import { EventCategoriesPage } from "./event-categories-page";

const { save, remove } = vi.hoisted(() => ({ save: vi.fn(), remove: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ back: vi.fn() }),
}));
vi.mock("@/entities/event", async (load) => {
  const actual = await load<typeof EventModule>();
  const color = Object.keys(actual.eventCategoryColors)[0];
  return {
    ...actual,
    useEventCategories: () => ({
      data: [
        { id: "category", name: "직장", color, sortOrder: 0 },
        { id: "other", name: "기타", color, sortOrder: 1 },
      ],
      isPending: false,
      isError: false,
    }),
    useSavedCategoryColors: () => ({
      data: [],
      isPending: false,
      isError: false,
    }),
  };
});
vi.mock("../model/use-category-editor", () => ({
  useCategoryEditor: () => ({
    onSave: save,
    onDelete: remove,
    deleting: false,
  }),
}));
beforeEach(() => {
  save.mockReset().mockResolvedValue(null);
  remove.mockReset().mockResolvedValue(null);
});
it.each(["직장", "기타"])(
  "CAL-08 ACC-13 P15.1b %s는 보기→수정→취소이며 기타 삭제를 숨겨요",
  async (name) => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>
          <ConfirmTestProvider>
            <EventCategoriesPage />
          </ConfirmTestProvider>
        </ToastProvider>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: `${name} 보기` }));
    expect(screen.getByRole("dialog", { name: "카테고리" })).toBeVisible();
    expect(screen.queryByLabelText("이름")).not.toBeInTheDocument();
    expect(
      Boolean(screen.queryByRole("button", { name: "카테고리 삭제" })),
    ).toBe(name !== "기타");
    fireEvent.click(screen.getByRole("button", { name: "카테고리 수정" }));
    expect(screen.getByLabelText("이름")).toHaveValue(name);
    expect(
      screen.queryByRole("button", { name: "카테고리 삭제" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "카테고리 수정" }),
      ).toBeVisible(),
    );
    expect(save).not.toHaveBeenCalled();
  },
);
it("CAL-08 P15.1b 수정한 이름과 기존 색을 저장해요", async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <ConfirmTestProvider>
          <EventCategoriesPage />
        </ConfirmTestProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "직장 보기" }));
  fireEvent.click(screen.getByRole("button", { name: "카테고리 수정" }));
  fireEvent.change(screen.getByLabelText("이름"), {
    target: { value: "회사" },
  });
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith({
      name: "회사",
      color: Object.keys(eventCategoryColors)[0],
      sortOrder: 0,
    }),
  );
});

it("CAL-08 P15.1b 보기 머리의 삭제도 확인 후 실행해요", async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <ConfirmTestProvider>
          <EventCategoriesPage />
        </ConfirmTestProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "직장 보기" }));
  fireEvent.click(screen.getByRole("button", { name: "카테고리 삭제" }));
  expect(remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "삭제" }));
  await waitFor(() => expect(remove).toHaveBeenCalledOnce());
});
