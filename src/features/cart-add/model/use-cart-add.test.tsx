import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CartInput, CartItem } from "@/entities/cart-item";
const state = vi.hoisted(() => ({ write: vi.fn() }));
vi.mock("@/entities/cart-item", () => ({
  useCartActions: () => ({ mutateAsync: state.write, isPending: false }),
}));
vi.mock("@/entities/inventory-item", () => ({
  useInventoryMeta: () => ({ data: { units: [] } }),
}));
import { useCartAdd } from "./use-cart-add";
const item: CartInput = {
  name: "휴지",
  quantity: 1,
  category_id: "saved-category",
  unit_id: null,
  memo: "큰 팩",
  link_url: "https://example.com/item",
  inventory_item_id: null,
};
beforeEach(() => state.write.mockReset().mockResolvedValue({}));
describe("CART-05 SCN-CART-6 칩 담기", () => {
  it("빠른 입력과 달리 저장한 카테고리를 쓰고 중복 항목을 따로 담을 때도 유지해요", async () => {
    state.write.mockResolvedValueOnce({
      duplicate: { ...item, id: "existing" } as CartItem,
    });
    const { result } = renderHook(() => useCartAdd(undefined, true));
    await act(() => result.current.onAdd(item, "ask", false));
    expect(state.write).toHaveBeenLastCalledWith({
      action: "add",
      item,
      duplicate: "ask",
      autoCategory: false,
    });
    expect(result.current.duplicate?.autoCategory).toBe(false);
    await act(() =>
      result.current.onAdd(
        item,
        "separate",
        result.current.duplicate?.autoCategory,
      ),
    );
    expect(state.write).toHaveBeenLastCalledWith({
      action: "add",
      item,
      duplicate: "separate",
      autoCategory: false,
    });
  });
  it("빠른 입력은 기존 자동 추천을 유지해요", async () => {
    const { result } = renderHook(() => useCartAdd(undefined, true));
    await act(() => result.current.onAdd(item));
    expect(state.write).toHaveBeenLastCalledWith(
      expect.objectContaining({ autoCategory: true }),
    );
  });
});
