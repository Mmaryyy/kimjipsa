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

describe("CART-01 CART-12 빠른 추가", () => {
  const units = [
    { id: "piece", name: "개" },
    { id: "tofu", name: "모" },
  ];
  it.each([
    ["두부 1모", "두부", 1, "모"],
    ["우유 1.5리터", "우유", 1.5, "리터"],
    ["쌀 2kg", "쌀", 2, "kg"],
  ])(
    "미등록 단위는 확인을 위해 따로 돌려줘요: %s",
    (value, name, quantity, unknownUnit) => {
      expect(parseCartQuickInput(value, [{ id: "piece", name: "개" }])).toEqual(
        {
          name,
          quantity,
          unit_id: "piece",
          unknownUnit,
        },
      );
    },
  );
  it.each([
    "비타민C1000",
    "비타민C1000mg",
    "P7 공동 품목",
    "아이폰 15 프로",
    "쿠키 2 종",
  ])("붙어 있는 숫자를 이름으로 유지해요: %s", (name) => {
    expect(parseCartQuickInput(name, units)).toEqual({
      name,
      quantity: 1,
      unit_id: "piece",
    });
  });
  it("등록된 단위는 숫자와 떨어져 있거나 대소문자가 달라도 읽어요", () => {
    expect(parseCartQuickInput("쌀 2 KG", [{ id: "kg", name: "kg" }])).toEqual({
      name: "쌀",
      quantity: 2,
      unit_id: "kg",
    });
    expect(parseCartQuickInput("두부 1 모", units)).toEqual({
      name: "두부",
      quantity: 1,
      unit_id: "tofu",
    });
  });
  it("기존에 등록된 공백 포함 단위도 유지해요", () => {
    expect(
      parseCartQuickInput("설탕 2큰 술", [{ id: "spoon", name: "큰 술" }]),
    ).toEqual({ name: "설탕", quantity: 2, unit_id: "spoon" });
  });
  it("수량만 입력하거나 등록된 단위를 붙여 써도 읽어요", () => {
    expect(parseCartQuickInput("두부2모", units)).toEqual({
      name: "두부",
      quantity: 2,
      unit_id: "tofu",
    });
    expect(parseCartQuickInput("두부 0", units)).toEqual({
      name: "두부",
      quantity: 0,
      unit_id: "piece",
    });
  });
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
