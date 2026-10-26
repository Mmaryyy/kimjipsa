import { describe, expect, it } from "vitest";
import {
  isVisibleCharacter,
  inventoryInputSchema,
  inventoryMetaInputSchema,
} from "./inventory.schema";
const entry = {
  name: "기타",
  sort_order: 0,
  enabled: true,
  icon_kind: "text",
  icon_value: "가",
};
describe("ACC-13 DEC-014 보이는 문자 한 글자", () => {
  const visibleCharacters = ["가", "😀", "👨‍👩‍👧‍👦", "👍🏽", "🇰🇷", "é", "1️⃣"];
  it.each(visibleCharacters)("%s는 허용해요", (value) =>
    expect(isVisibleCharacter(value)).toBe(true),
  );
  it.each([" ", "\u200d", "\u0301", "가나", "😀😀", "\n"])(
    "보이지 않거나 두 글자인 %s는 거부해요",
    (value) => expect(isVisibleCharacter(value)).toBe(false),
  );
  it("아이콘 종류별 값과 목록 이름 상한을 검사해요", () => {
    expect(
      inventoryMetaInputSchema.safeParse({ ...entry, icon_value: "가나" })
        .success,
    ).toBe(false);
    expect(
      inventoryMetaInputSchema.safeParse({ ...entry, name: "가".repeat(31) })
        .success,
    ).toBe(false);
    expect(
      inventoryMetaInputSchema.safeParse({
        ...entry,
        icon_kind: "lucide",
        icon_value: "milk",
      }).success,
    ).toBe(true);
    expect(
      inventoryMetaInputSchema.safeParse({
        ...entry,
        icon_kind: "lucide",
        icon_value: "unknown",
      }).success,
    ).toBe(false);
    expect(
      inventoryMetaInputSchema.safeParse({
        ...entry,
        icon_kind: null,
        icon_value: "milk",
      }).success,
    ).toBe(false);
  });
});
describe("INV-01 SCN-INV-1 품목 입력", () => {
  const item = {
    name: "우유",
    mode: "quantity",
    quantity: 2,
    status: "enough",
    unit_id: crypto.randomUUID(),
    location_id: crypto.randomUUID(),
    category_id: null,
    min_quantity: 1,
    expires_on: null,
  };
  it("수량과 단위를 검증하고 이름 상한을 지켜요", () => {
    expect(inventoryInputSchema.parse(item).quantity).toBe(2);
    expect(
      inventoryInputSchema.safeParse({ ...item, name: "가".repeat(101) })
        .success,
    ).toBe(false);
    expect(
      inventoryInputSchema.safeParse({ ...item, unit_id: null }).success,
    ).toBe(false);
  });
});
