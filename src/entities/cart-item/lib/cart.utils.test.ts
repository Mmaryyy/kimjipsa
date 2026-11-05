import { describe, expect, it } from "vitest";
import {
  frequentCartItems,
  groupCartItems,
  parseCartQuickInput,
  withFrequentCartDefaults,
} from "./cart.utils";
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
  checked_at: null,
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

describe("CART-05 SCN-CART-6 기본 품목 채우기", () => {
  const defaults = ["휴지", "변기 세정제", "세탁세제", "생수"];
  it("기본 품목의 카테고리를 이름으로 찾고 구매 기록의 카테고리는 유지해요", () => {
    const categories = [
      { id: "household", name: "생활용품" },
      { id: "drinks", name: "음료" },
      { id: "other", name: "기타" },
    ];
    expect(
      withFrequentCartDefaults([], [], categories).map(
        (item) => item.category_id,
      ),
    ).toEqual(["household", "household", "household", "drinks"]);
    const purchased = { ...purchase("휴지"), category_id: "original" };
    expect(withFrequentCartDefaults([purchased], [], categories)[0]).toBe(
      purchased,
    );
  });
  it("기본 카테고리를 지우거나 이름을 바꾸면 기타로 담고 기타도 없으면 비워요", () => {
    const categories = [
      { id: "renamed", name: "바꾼 이름" },
      { id: "other", name: "기타" },
    ];
    expect(
      withFrequentCartDefaults([], [], categories).map(
        (item) => item.category_id,
      ),
    ).toEqual(["other", "other", "other", "other"]);
    expect(
      withFrequentCartDefaults([], [], categories.slice(0, 1)).every(
        (item) => item.category_id === null,
      ),
    ).toBe(true);
  });
  it("가정의 단위 ID와 기본 설명을 채우고 구매 기록의 정보는 유지해요", () => {
    const units = [
      { id: "pack", name: "팩" },
      { id: "bottle", name: "통" },
      { id: "bundle", name: "번들" },
    ];
    const purchased = {
      ...purchase("휴지"),
      unit_id: "original",
      memo: "기록",
    };
    const result = withFrequentCartDefaults([purchased], units);
    expect(result[0]).toBe(purchased);
    expect(
      result
        .slice(1)
        .map(({ name, unit_id, memo }) => ({ name, unit_id, memo })),
    ).toEqual([
      { name: "변기 세정제", unit_id: "pack", memo: "" },
      { name: "세탁세제", unit_id: "bottle", memo: "" },
      { name: "생수", unit_id: "bundle", memo: "12개입" },
    ]);
    expect(withFrequentCartDefaults([], units)[0]?.unit_id).toBe("pack");
  });
  it("단위가 없어도 확인창용 필드 없이 단위만 비워 담아요", () => {
    const result = withFrequentCartDefaults([], []);
    expect(result.every((item) => item.unit_id === null)).toBe(true);
    expect(result.find((item) => item.name === "생수")?.memo).toBe("12개입");
    expect(result.every((item) => !("unknownUnit" in item))).toBe(true);
  });
  it("구매 기록이 없으면 기본 네 개만 보여 줘요", () => {
    const result = withFrequentCartDefaults(frequentCartItems([], now));
    expect(result.map((item) => item.name)).toEqual(defaults);
    expect(result.every((item) => item.quantity === 1)).toBe(true);
  });
  it("구매 기록의 순서와 정보를 유지하고 기본 품목을 뒤에 채워요", () => {
    const items = [purchase("두부"), purchase("두부")];
    const frequent = frequentCartItems(items, now);
    const result = withFrequentCartDefaults(frequent);
    expect(result.map((item) => item.name)).toEqual(["두부", ...defaults]);
    expect(result[0]).toBe(frequent[0]);
    expect(frequent).toHaveLength(1);
  });
  it("공백과 대소문자를 무시해 겹치는 이름은 채우지 않아요", () => {
    const result = withFrequentCartDefaults([
      purchase(" 변기세정제 "),
      purchase("생 수"),
    ]);
    expect(result.map((item) => item.name)).toEqual([
      " 변기세정제 ",
      "생 수",
      "휴지",
      "세탁세제",
    ]);
  });
  it.each([9, 10, 12])("구매 품목이 %i개여도 10개를 넘지 않아요", (count) => {
    const items = Array.from({ length: count }, (_, index) =>
      purchase(`품목${index}`),
    );
    const result = withFrequentCartDefaults(items);
    expect(result).toHaveLength(10);
    expect(result.slice(0, Math.min(count, 10))).toEqual(items.slice(0, 10));
    if (count === 9) expect(result[9]?.name).toBe("휴지");
  });
});

describe("CART-02 코너 묶기", () => {
  it.each([true, false])(
    "정렬하고 없는 ID와 미지정 항목을 기타로 묶어요: %s",
    (hasOther) => {
      const categories = [
        { id: "b", name: "나", sort_order: 2 },
        { id: "a", name: "가", sort_order: 1 },
        ...(hasOther ? [{ id: "other", name: "기타", sort_order: 3 }] : []),
      ];
      const known = { ...purchase("두부"), category_id: "a" };
      const unknown = { ...purchase("우유"), category_id: "new" };
      const unassigned = purchase("휴지");
      const groups = groupCartItems([known, unknown, unassigned], categories);
      expect(groups.map((group) => group.id)).toEqual([
        "a",
        "b",
        hasOther ? "other" : "unassigned",
      ]);
      expect(groups[0]?.items).toEqual([known]);
      expect(groups[2]?.items).toEqual([unknown, unassigned]);
      expect(categories[0]?.id).toBe("b");
    },
  );
});
