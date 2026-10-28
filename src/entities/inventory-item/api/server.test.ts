import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
const defaults: unknown = JSON.parse(
  readFileSync("mocks/inventory-defaults.json", "utf8"),
);
const fixture: unknown = JSON.parse(
  readFileSync("mocks/inventory-items.json", "utf8"),
);
import {
  inventoryMetaSchema,
  inventoryItemSchema,
} from "../model/inventory.schema";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ values: new Map<string, unknown>() }));
vi.mock("@/shared/server", () => ({
  mockContext: async () => ({}),
  mockJson: async (name: string) => state.values.get(name),
  createServerSupabaseClient: vi.fn(),
  throwDatabaseError: vi.fn(),
}));
import { listInventory, writeInventory, writeInventoryMeta } from "./server";
let meta = inventoryMetaSchema.parse(defaults);
let items = (fixture as unknown[]).map((item) =>
  inventoryItemSchema.parse(item),
);
beforeEach(() => {
  meta = inventoryMetaSchema.parse(defaults);
  items = (fixture as unknown[]).map((item) => inventoryItemSchema.parse(item));
  state.values = new Map<string, unknown>([
    ["inventory-meta", meta],
    ["inventory-defaults", inventoryMetaSchema.parse(defaults)],
    ["inventory-items", items],
    ["cart-items", []],
  ]);
});
describe("INV-01~08 목업 변경 경로", () => {
  it("SCN-INV-4 사용 중인 단위는 삭제하지 못해요", async () => {
    await expect(
      writeInventoryMeta({
        action: "delete",
        kind: "units",
        id: items[0]!.unit_id,
      }),
    ).rejects.toThrow("단위를 먼저");
    expect(meta.units.some((unit) => unit.id === items[0]!.unit_id)).toBe(true);
  });
  it("SCN-INV-5 장소를 숨겨도 품목을 유지하고 되돌리면 연결과 표시를 복구해요", async () => {
    const location = meta.locations[0]!;
    await writeInventoryMeta({
      action: "save",
      kind: "locations",
      id: location.id,
      entry: { ...location, enabled: false },
    });
    expect(meta.locations[0]!.enabled).toBe(false);
    expect((await listInventory())[0]!.location_id).toBe(location.id);
    await writeInventoryMeta({ action: "reset", kind: "locations" });
    expect(
      meta.locations.find((entry) => entry.id === location.id)?.enabled,
    ).toBe(true);
    expect(items[0]!.location_id).toBe(location.id);
  });
  const resetCategoriesTestName =
    "카테고리 되돌리기는 기본 연결을 유지하고 " +
    "직접 추가한 분류만 기타로 옮겨요";
  it(resetCategoriesTestName, async () => {
    const original = items[0]!.category_id;
    const custom = {
      ...meta.categories[0]!,
      id: crypto.randomUUID(),
      name: "직접 추가",
    };
    meta.categories.push(custom);
    items[1]!.category_id = custom.id;
    await writeInventoryMeta({ action: "reset", kind: "categories" });
    expect(items[0]!.category_id).toBe(original);
    expect(items[1]!.category_id).toBe(
      meta.categories.find((entry) => entry.name === "기타")?.id,
    );
    expect(meta.categories.some((entry) => entry.id === custom.id)).toBe(false);
  });
  it("카테고리 단건 삭제도 기타로 옮기고 기타 삭제는 막아요", async () => {
    const other = meta.categories.find((entry) => entry.name === "기타")!;
    await writeInventoryMeta({
      action: "delete",
      kind: "categories",
      id: items[0]!.category_id,
    });
    expect(items[0]!.category_id).toBe(other.id);
    await expect(
      writeInventoryMeta({
        action: "delete",
        kind: "categories",
        id: other.id,
      }),
    ).rejects.toThrow("삭제할 수 없어요");
  });
  it("SCN-INV-3 상태만 변경하면 배우자의 다른 수정은 남아요", async () => {
    const item = items.find((item) => item.mode === "status")!;
    item.name = "배우자가 바꾼 이름";
    await writeInventory({ action: "status", id: item.id, status: "low" });
    expect(item.name).toBe("배우자가 바꾼 이름");
    expect(item.status).toBe("low");
    await writeInventory({ action: "used-up", id: item.id });
    expect(item.status).toBe("none");
  });
  it.each([-1, 31, 99999, 2147483648])(
    "임박 기준 %s일은 거부해요",
    async (days) => {
      await expect(
        writeInventoryMeta({ action: "expiry", days }),
      ).rejects.toThrow();
      expect(meta.expiry_days).toBe(3);
    },
  );
});

describe("CART-04 CART-06 재고와 장바구니 연결", () => {
  it("카테고리를 지우면 장바구니도 기타로 옮겨요", async () => {
    const category = meta.categories.find((entry) => entry.name !== "기타")!;
    const cart = [{ category_id: category.id }];
    state.values.set("cart-items", cart);
    await writeInventoryMeta({
      action: "delete",
      kind: "categories",
      id: category.id,
    });
    expect(cart[0]?.category_id).toBe(
      meta.categories.find((entry) => entry.name === "기타")?.id,
    );
  });
  it("장바구니에서 쓰는 단위도 삭제를 막고 초기화할 때 유지해요", async () => {
    const unit = {
      ...meta.units[0]!,
      id: crypto.randomUUID(),
      name: "사용자 단위",
    };
    meta.units.push(unit);
    state.values.set("cart-items", [{ unit_id: unit.id }]);
    await expect(
      writeInventoryMeta({ action: "delete", kind: "units", id: unit.id }),
    ).rejects.toThrow("단위를 먼저");
    await writeInventoryMeta({ action: "reset", kind: "units" });
    expect(meta.units.some((entry) => entry.id === unit.id)).toBe(true);
  });
  it("재고를 삭제하면 장바구니 품목은 남기고 연결만 비워요", async () => {
    const item = items[0]!;
    const cart = [{ inventory_item_id: item.id }];
    state.values.set("cart-items", cart);
    await writeInventory({ action: "delete", id: item.id });
    expect(cart).toHaveLength(1);
    expect(cart[0]?.inventory_item_id).toBeNull();
  });
});
