import { describe, expect, it } from "vitest";
import { frequentCartItems, parseCartQuickInput } from "./cart.utils";
import type { CartItem } from "../api/type";
const now = Date.parse("2026-10-26T00:00:00Z");
const purchase = (name: string, days = 1): CartItem => ({
  id: crypto.randomUUID(),
  created_at: new Date(now - days * 86400000).toISOString(),
  name,
  quantity: 1,
  unit_id: null,
  category_id: null,
  memo: "",
  link_url: "",
  added_by: null,
  checked_by: null,
  is_checked: true,
  inventory_item_id: null,
  purchased_at: new Date(now - days * 86400000).toISOString(),
});
describe("CART-05 SCN-CART-6 자주 사는 품목", () => {
  it("정규화한 이름의 구매를 합치고 두 번 이상 구매한 품목만 보여 줘요", () => {
    const items = [
      purchase("Milk Tea"),
      purchase("milk tea"),
      purchase("두부"),
      { ...purchase("우유"), purchased_at: null },
    ];
    expect(frequentCartItems(items, now).map((item) => item.name)).toEqual([
      "Milk Tea",
    ]);
  });
  it("90일 구매 횟수로 정렬하고 오래된 기록도 두 번 구매한 자격에는 포함해요", () => {
    const items = [
      purchase("두부", 90),
      purchase("두부", 1),
      purchase("우유", 91),
      purchase("우유", 1),
    ];
    expect(frequentCartItems(items, now).map((item) => item.name)).toEqual([
      "두부",
      "우유",
    ]);
  });
  it("구매 횟수 순서로 최대 10개를 보여 줘요", () => {
    const items = Array.from({ length: 12 }, (_, index) =>
      Array.from({ length: index + 2 }, () => purchase(`품목${index}`)),
    ).flat();
    const result = frequentCartItems(items, now);
    expect(result).toHaveLength(10);
    expect(result[0]?.name).toBe("품목11");
    expect(result[9]?.name).toBe("품목2");
  });
});

describe("CART-01 빠른 추가", () => {
  const units = [
    { id: "piece", name: "개" },
    { id: "tofu", name: "모" },
  ];
  it("수량과 등록된 단위를 나누고 숫자가 들어간 품목 이름은 유지해요", () => {
    expect(parseCartQuickInput("두부 2모", units)).toEqual({
      name: "두부",
      quantity: 2,
      unit_id: "tofu",
    });
    expect(parseCartQuickInput("P7 공동 품목", units)).toEqual({
      name: "P7 공동 품목",
      quantity: 1,
      unit_id: "piece",
    });
    expect(parseCartQuickInput("비타민C1000", units).name).toBe("비타민C1000");
  });
});
