import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CartData, CartItem, groupCartItems } from "@/entities/cart-item";
import type { InventoryMeta } from "@/entities/inventory-item";
import { cartSummary } from "./cart-summary.utils";
import CartSummary from ".";

const state = vi.hoisted(() => ({ cart: {}, meta: {} }));
vi.mock("@/entities/cart-item", async (importOriginal) => ({
  ...(await importOriginal<{ groupCartItems: typeof groupCartItems }>()),
  useCart: () => state.cart,
}));
vi.mock("@/entities/inventory-item", () => ({
  useInventoryMeta: () => state.meta,
}));
const instant = new Date("2026-11-05T01:18:00Z");
const item = (overrides: Partial<CartItem> = {}): CartItem => ({
  id: "item",
  name: "두부",
  quantity: 1,
  unit_id: "unit",
  category_id: "a",
  memo: "",
  link_url: "",
  inventory_item_id: null,
  added_by: "me",
  created_at: "2026-11-05T00:00:00Z",
  is_checked: false,
  checked_by: null,
  checked_at: null,
  purchased_at: null,
  ...overrides,
});
const data = (items: CartItem[]): CartData => ({
  items,
  frequent: [],
  familyId: "family",
  actorId: "me",
  members: [{ user_id: "partner", display_name: "민호" }],
});
const meta = {
  categories: ["a", "b", "c", "d"].map((id, index) => ({
    id,
    name: `코너${id}`,
    sort_order: 3 - index,
  })),
  units: [{ id: "unit", name: "팩" }],
} as InventoryMeta;

describe("CART-02 CART-03 CART-04 홈 장바구니 요약", () => {
  beforeEach(() => {
    state.cart = { data: data([]) };
    state.meta = { data: meta };
  });
  it("구매 전 항목만 세고 가장 최근 체크를 본인과 배우자 문구로 보여요", () => {
    const items = [
      item(),
      item({
        is_checked: true,
        checked_by: "partner",
        checked_at: "2026-11-05T01:00:00Z",
      }),
      item({
        is_checked: true,
        checked_by: "me",
        checked_at: "2026-11-05T00:00:00Z",
      }),
      item({
        is_checked: true,
        purchased_at: instant.toISOString(),
        checked_at: instant.toISOString(),
      }),
    ];
    expect(cartSummary(data(items), meta, instant)).toMatchObject({
      total: 3,
      checked: 2,
      activity: "민호 님이 18분 전에 두부를 담았어요",
    });
    items[1]!.checked_by = "me";
    expect(cartSummary(data(items), meta, instant).activity).toBe(
      "내가 18분 전에 두부를 담았어요",
    );
  });
  it.each([0, 59_999, -30_000])(
    "60초 미만과 미래 체크는 방금으로 표시해요: %i",
    (elapsed) => {
      const checked = item({
        is_checked: true,
        checked_by: "partner",
        checked_at: new Date(instant.getTime() - elapsed).toISOString(),
      });
      expect(cartSummary(data([checked]), meta, instant).activity).toBe(
        "민호 님이 방금 두부를 담았어요",
      );
    },
  );
  it("정확히 60초가 지나면 분 단위로 표시해요", () => {
    const checked = item({
      is_checked: true,
      checked_by: "me",
      checked_at: new Date(instant.getTime() - 60_000).toISOString(),
    });
    expect(cartSummary(data([checked]), meta, instant).activity).toBe(
      "내가 1분 전에 두부를 담았어요",
    );
  });
  it("메타에 없는 카테고리는 기타 코너에 포함해요", () => {
    expect(
      cartSummary(data([item({ category_id: "new" })]), meta, instant),
    ).toMatchObject({
      total: 1,
      groups: [{ id: "unassigned", name: "기타", text: "두부 1팩" }],
    });
  });
  it("코너 순서로 묶고 수량과 단위를 표시하며 세 줄까지만 보여요", () => {
    const items = ["a", "b", "c", "d"].map((category_id) =>
      item({ category_id }),
    );
    items.push(item({ name: "우유", category_id: "d", quantity: 2 }));
    items.push(item({ name: "제외", category_id: "d", is_checked: true }));
    const summary = cartSummary(data(items), meta, instant);
    expect(summary.groups.map((group) => group.id)).toEqual(["d", "c", "b"]);
    expect(summary.groups[0]?.text).toBe("두부 1팩 · 우유 2팩");
    expect(summary.remaining).toBe(1);
    expect(summary.activity).toBeUndefined();
  });
  it("남은 코너 수는 세 코너 목록 아래 별도 보조 줄로 보여요", () => {
    state.cart = {
      data: data(
        ["a", "b", "c", "d"].map((category_id) =>
          item({ id: category_id, category_id }),
        ),
      ),
    };
    const view = render(<CartSummary instant={instant} />);
    const remaining = screen.getByText("외 1개 코너");
    const lastRow = view.container.querySelector('[data-od-id="cart-next-3"]');
    expect(lastRow).toHaveTextContent("코너b두부 1팩");
    expect(lastRow).not.toContainElement(remaining);
    expect(remaining.tagName).toBe("P");
    expect(lastRow?.closest("ul")?.nextElementSibling).toBe(remaining);

    state.cart = { data: data([item()]) };
    view.rerender(<CartSummary instant={instant} />);
    expect(screen.queryByText(/외 .*개 코너/)).not.toBeInTheDocument();
  });
  it("빈 상태에서도 장바구니 열기 링크가 있어요", () => {
    render(<CartSummary instant={instant} />);
    expect(screen.getByText("장바구니가 비어 있어요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "열기" })).toHaveAttribute(
      "href",
      "/cart",
    );
  });
  it("체크가 없으면 최근 담음 줄을 숨기고 오프라인의 마지막 목록을 유지해요", () => {
    state.cart = { data: data([item()]), offline: true, isError: true };
    render(<CartSummary instant={instant} />);
    expect(screen.getByText(/1개 중/)).toBeInTheDocument();
    expect(screen.queryByText(/담았어요/)).not.toBeInTheDocument();
    expect(screen.getByText(/마지막 장바구니/)).toBeInTheDocument();
  });
  it("불러오는 중과 조회 오류를 빈 상태와 구분해요", () => {
    state.cart = { isPending: true };
    const view = render(<CartSummary instant={instant} />);
    expect(
      screen.getByRole("group", { name: "장바구니를 불러오고 있어요" }),
    ).toHaveAttribute("aria-busy", "true");
    state.cart = {
      isError: true,
      error: new Error("조회 실패"),
      refetch: vi.fn(),
    };
    view.rerender(<CartSummary instant={instant} />);
    expect(screen.getByText("조회 실패")).toBeInTheDocument();
  });
});
