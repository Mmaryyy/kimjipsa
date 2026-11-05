import type { AnchorHTMLAttributes, ComponentProps } from "react";
import type * as DndModule from "@dnd-kit/core";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markHistoryBack } from "@/shared/lib";
import { inventoryRoutes } from "@/shared/config";
import { ToastProvider } from "@/shared/ui";
import InventoryListsPage from ".";
vi.mock("@dnd-kit/core", async (original) => ({
  ...(await original<typeof DndModule>()),
  DndContext: ({
    children,
    onDragStart,
    onDragEnd,
  }: ComponentProps<typeof DndModule.DndContext>) => {
    const active = {
      id: "first",
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
                id: "second",
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

const state = vi.hoisted(() => ({
  order: vi.fn(),
  back: vi.fn(),
  offline: false,
  from: "",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: state.back }),
  useSearchParams: () =>
    new URLSearchParams(`kind=categories&from=${state.from}`),
}));
vi.mock("next/link", () => ({
  default: ({
    onNavigate,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    onNavigate?: (event: { preventDefault: () => void }) => void;
  }) => (
    <a
      {...props}
      onClick={(event) => {
        if (!event.ctrlKey && !event.metaKey) onNavigate?.(event);
        event.preventDefault();
      }}
    />
  ),
}));
vi.mock("@/entities/cart-item", () => ({
  useCart: () => ({ data: {}, offline: state.offline }),
  useCartActions: () => ({ mutateAsync: state.order, isPending: false }),
}));
vi.mock("@/entities/inventory-item", () => ({
  useInventoryMeta: () => ({
    refetch: vi.fn().mockResolvedValue({}),
    data: {
      categories: [
        { id: "second", name: "생활용품", sort_order: 1 },
        { id: "first", name: "식품", sort_order: 0 },
      ],
    },
  }),
  useInventoryActions: () => ({ meta: {} }),
  InventoryCategoryIcon: () => null,
}));
vi.mock("../list-editor", () => ({ default: () => null }));
afterEach(cleanup);
beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState({}, "", inventoryRoutes.lists);
  state.back.mockReset();
  state.offline = false;
  state.from = "";
  state.order.mockReset().mockResolvedValue({});
});
describe("CART-04 카테고리 관리 순서 변경", () => {
  it("손잡이와 추가 버튼을 제공해요", () => {
    const { container } = render(
      <ToastProvider>
        <InventoryListsPage />
      </ToastProvider>,
    );
    expect(
      screen.getByRole("button", { name: "식품 수정하기" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "순서 바꾸기" })).toHaveLength(
      2,
    );
    expect(
      screen.queryByRole("button", { name: /위로 이동/ }),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-od-id="lists-header"]'),
    ).toContainElement(
      screen.getByRole("button", { name: "재고 카테고리 추가" }),
    );
  });
  // prettier-ignore
  it(
    "SCN-CART-2 드래그한 순서를 order 액션으로 저장하고 성공 토스트를 보여 줘요",
    async () => {
      render(
        <ToastProvider>
          <InventoryListsPage />
        </ToastProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: "카테고리 옮기기" }));
      await waitFor(() =>
        expect(state.order).toHaveBeenCalledWith({
          action: "order",
          ids: ["second", "first"],
        }),
      );
      expect(await screen.findByText("순서를 저장했어요")).toBeVisible();
    },
  );
  it("저장에 실패하면 원래 순서와 오류 안내를 보여 줘요", async () => {
    state.order.mockRejectedValue(new Error("연결 실패"));
    render(
      <ToastProvider>
        <InventoryListsPage />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "카테고리 옮기기" }));
    expect(await screen.findByText(/순서를 저장하지 못해/)).toBeVisible();
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("식품");
  });
  it("오프라인에서는 순서를 저장할 수 없어요", () => {
    state.offline = true;
    render(
      <ToastProvider>
        <InventoryListsPage />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "카테고리 옮기기" }));
    expect(state.order).not.toHaveBeenCalled();
    for (const handle of screen.getAllByRole("button", { name: "순서 바꾸기" }))
      expect(handle).toBeDisabled();
  });
});

it.each([
  ["cart", "장바구니", "/cart"],
  ["inventory", "재고", "/inventory"],
  ["", "설정", "/settings"],
])("CART-04 %s에서 진입하면 원래 화면으로 돌아가요", (from, _label, href) => {
  state.from = from;
  markHistoryBack(inventoryRoutes.lists);
  render(
    <ToastProvider>
      <InventoryListsPage />
    </ToastProvider>,
  );
  const link = screen.getByRole("link", { name: "뒤로" });
  expect(link).toHaveAttribute("href", href);
  fireEvent.click(link);
  expect(state.back).toHaveBeenCalledOnce();
  expect(sessionStorage.getItem(inventoryRoutes.lists)).toBeNull();
  expect(window.history.state[inventoryRoutes.lists]).toBe(true);
});

it.each([
  ["", "/settings"],
  ["cart", "/cart"],
  ["inventory", "/inventory"],
])("ACC-13 직접 진입하면 %s 출처로 이동해요", (from, href) => {
  state.from = from;
  render(
    <ToastProvider>
      <InventoryListsPage />
    </ToastProvider>,
  );
  const link = screen.getByRole("link", { name: "뒤로" });
  expect(link).toHaveAttribute("href", href);
  expect(link).toHaveTextContent("");
  fireEvent.click(link);
  expect(state.back).not.toHaveBeenCalled();
});
