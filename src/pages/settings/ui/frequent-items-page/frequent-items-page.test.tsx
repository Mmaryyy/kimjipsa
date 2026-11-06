import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CartInput } from "@/entities/cart-item";
const state = vi.hoisted(() => ({ offline: false, from: "cart" }));
const item = (
  name: string,
  hidden = false,
): CartInput & { hidden: boolean } => ({
  name,
  hidden,
  quantity: 1,
  category_id: null,
  unit_id: null,
  inventory_item_id: null,
  memo: "",
  link_url: "",
});
vi.mock("@/entities/cart-item", () => ({
  useCart: () => ({
    data: {
      frequent: [item("두부"), item("우유")],
      frequentSettings: [
        item("우유"),
        item("숨긴 품목", true),
        item("두부"),
        item("하위 후보"),
      ],
    },
    offline: state.offline,
  }),
}));
vi.mock("@/entities/inventory-item", () => ({
  useInventoryMeta: () => ({ data: { categories: [], units: [] } }),
}));
vi.mock("@/features/cart-item-edit", () => ({ CartItemEditor: () => null }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams({ from: state.from }),
  useRouter: () => ({ back: vi.fn() }),
}));
import FrequentItemsPage from ".";
afterEach(() => {
  cleanup();
  state.offline = false;
  state.from = "cart";
});
describe("CART-05 SCN-CART-6 자주 사는 품목 설정", () => {
  it("실제 칩 순서와 그 밖의 후보를 나누고 숨김을 표시해요", () => {
    render(<FrequentItemsPage />);
    const visible = screen.getByRole("region", {
      name: "장바구니에 보이는 품목",
    });
    expect(
      within(visible)
        .getAllByRole("button")
        .map((button) => button.textContent?.trim()),
    ).toEqual(["두부", "우유"]);
    const other = screen.getByRole("region", { name: "그 밖의 후보" });
    expect(
      within(other).getByRole("button", { name: "숨긴 품목 숨김" }),
    ).toBeEnabled();
    expect(
      within(other).getByRole("button", { name: "하위 후보" }),
    ).toBeEnabled();
    expect(screen.getByRole("link", { name: "뒤로" })).toHaveAttribute(
      "href",
      "/cart",
    );
  });
  it("오프라인에서는 편집을 막고 직접 진입하면 설정으로 돌아가요", () => {
    state.offline = true;
    state.from = "";
    render(<FrequentItemsPage />);
    expect(screen.getByRole("button", { name: "두부" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "숨긴 품목 숨김" }),
    ).toBeDisabled();
    expect(screen.getByRole("link", { name: "뒤로" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });
});
