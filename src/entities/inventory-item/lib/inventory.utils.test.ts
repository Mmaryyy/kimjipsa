import { describe, expect, it } from "vitest";
import {
  inventoryState,
  inventoryExpiring,
  inventoryExpiryLabel,
} from "./inventory.utils";
import type { InventoryItem } from "../api/type";
const item: InventoryItem = {
  id: crypto.randomUUID(),
  name: "우유",
  mode: "quantity",
  quantity: 2,
  status: "enough",
  unit_id: crypto.randomUUID(),
  category_id: null,
  location_id: null,
  min_quantity: 1,
  expires_on: "2026-10-25",
};
describe("INV-03 SCN-INV-2 수량 경계", () => {
  it.each([
    [0, null, "none"],
    [1, null, "enough"],
    [1, 1, "low"],
    [2, 1, "enough"],
    [1, 0, "enough"],
    [0, 0, "none"],
  ] as const)("수량 %s 최소 %s는 %s", (quantity, min_quantity, state) => {
    expect(inventoryState({ ...item, quantity, min_quantity })).toBe(state);
  });
});
describe("INV-05 KST 유통기한", () => {
  it("KST 자정 전후에 남은 일수를 바꿔요", () => {
    expect(inventoryExpiring(item, 0, new Date("2026-10-24T14:59:59Z"))).toBe(
      false,
    );
    expect(inventoryExpiring(item, 0, new Date("2026-10-24T15:00:00Z"))).toBe(
      true,
    );
  });
  it("지난 기한은 일수로 표시하고 다 쓴 품목은 제외해요", () => {
    const now = new Date("2026-10-27T00:00:00+09:00");
    expect(inventoryExpiring(item, 3, now)).toBe(true);
    expect(inventoryExpiryLabel(item, now)).toBe("2일 지남");
    expect(inventoryExpiring({ ...item, quantity: 0 }, 3, now)).toBe(false);
    expect(
      inventoryExpiring({ ...item, mode: "status", status: "none" }, 3, now),
    ).toBe(false);
    expect(inventoryExpiring({ ...item, expires_on: null }, 3, now)).toBe(
      false,
    );
  });
  it.each([
    ["2026-10-25", "오늘까지"],
    ["2026-10-26", "내일까지"],
    ["2026-10-28", "3일 남음"],
  ])("%s는 %s", (expires_on, label) => {
    expect(
      inventoryExpiryLabel(
        { ...item, expires_on },
        new Date("2026-10-25T12:00:00+09:00"),
      ),
    ).toBe(label);
  });
});
