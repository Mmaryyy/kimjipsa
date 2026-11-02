import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/shared/ui";
import InventoryListsPage from ".";
const state = vi.hoisted(() => ({ order: vi.fn(), offline: false, from: "" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () =>
    new URLSearchParams(`kind=categories&from=${state.from}`),
}));
vi.mock("@/entities/cart-item", () => ({
  useCart: () => ({ data: {}, offline: state.offline }),
  useCartActions: () => ({ mutateAsync: state.order, isPending: false }),
}));
vi.mock("@/entities/inventory-item", () => ({
  useInventoryMeta: () => ({
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
  state.offline = false;
  state.from = "";
  state.order.mockReset().mockResolvedValue({});
});
describe("CART-04 카테고리 관리 순서 변경", () => {
  it("이름 편집 버튼과 함께 위아래 이동을 제공하고 기존 order 명령으로 저장해요", async () => {
    render(
      <ToastProvider>
        <InventoryListsPage />
      </ToastProvider>,
    );
    expect(screen.getByRole("button", { name: "식품" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "식품 위로 이동" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "생활용품 아래로 이동" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "생활용품 위로 이동" }));
    await waitFor(() =>
      expect(state.order).toHaveBeenCalledWith({
        action: "order",
        ids: ["second", "first"],
      }),
    );
  });
  it("오프라인에서는 순서를 저장할 수 없어요", () => {
    state.offline = true;
    render(
      <ToastProvider>
        <InventoryListsPage />
      </ToastProvider>,
    );
    expect(
      screen.getByRole("button", { name: "생활용품 위로 이동" }),
    ).toBeDisabled();
  });
});

it.each([
  ["cart", "장바구니", "/cart"],
  ["inventory", "재고", "/inventory"],
  ["", "설정", "/settings"],
])("CART-04 %s에서 진입하면 원래 화면으로 돌아가요", (from, label, href) => {
  state.from = from;
  render(
    <ToastProvider>
      <InventoryListsPage />
    </ToastProvider>,
  );
  expect(screen.getByRole("link", { name: label })).toHaveAttribute(
    "href",
    href,
  );
});
