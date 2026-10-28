import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeItemName } from "@/shared/lib";
import type {
  cartItemSchema,
  CartInput,
  RestockEntry,
} from "../model/cart.schema";
import type { MockData } from "@/shared/server";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  perspective: 0,
}));
vi.mock("@/shared/server", () => ({
  mockContext: async () => ({ perspective: state.perspective }),
  mockJson: async (name: string) => state.values.get(name),
  createServerSupabaseClient: vi.fn(),
  throwDatabaseError: vi.fn(),
}));
import { listCart, writeCart } from "./server";
const json = (name: string): unknown =>
  JSON.parse(readFileSync(`mocks/${name}.json`, "utf8"));
const getMeta = () => json("inventory-meta") as MockData["inventory-meta"];
const getInventory = () =>
  json("inventory-items") as MockData["inventory-items"];
let meta = getMeta();
let inventory = getInventory();
let items: ReturnType<typeof cartItemSchema.parse>[] = [];
const actorId = "10000000-0000-4000-8000-000000000001";
const partnerId = "10000000-0000-4000-8000-000000000002";
function input(overrides: Partial<CartInput> = {}): CartInput {
  return {
    name: "새 두부",
    quantity: 2,
    unit_id: meta.units[0]!.id,
    category_id: meta.categories[0]!.id,
    memo: "",
    link_url: "",
    inventory_item_id: null,
    ...overrides,
  };
}
async function add(overrides: Partial<CartInput> = {}) {
  const result = await writeCart({
    action: "add",
    item: input(overrides),
    duplicate: "separate",
  });
  return result.item!;
}
async function checked(overrides: Partial<CartInput> = {}) {
  const item = await add(overrides);
  await writeCart({ action: "check", id: item.id, checked: true });
  return item;
}
function entry(
  id: string,
  overrides: Partial<RestockEntry> = {},
): RestockEntry {
  return {
    id,
    quantity: 2,
    unit_id: meta.units[0]!.id,
    category_id: meta.categories[0]!.id,
    location_id: meta.locations.find((location) => location.enabled)!.id,
    expires_on: null,
    ...overrides,
  };
}
beforeEach(() => {
  meta = getMeta();
  inventory = getInventory();
  items = [];
  state.perspective = 0;
  state.values = new Map<string, unknown>([
    ["cart-items", items],
    ["inventory-items", inventory],
    ["inventory-meta", meta],
    [
      "family",
      {
        id: crypto.randomUUID(),
        members: [
          { user_id: actorId, display_name: "지수" },
          { user_id: partnerId, display_name: "민호" },
        ],
      },
    ],
  ]);
});
describe("CART-01 CART-03 CART-12 CART-13 SCN-CART-1 공동 장보기", () => {
  it("같은 이름은 ask로 안내하고 merge는 수량을 더하며 separate는 따로 추가해요", async () => {
    const first = await add({ name: "Milk Tea" });
    const duplicate = input({ name: " milk TEA " });
    expect(
      (await writeCart({ action: "add", item: duplicate, duplicate: "ask" }))
        .duplicate?.id,
    ).toBe(first.id);
    expect(items).toHaveLength(1);
    await writeCart({ action: "add", item: duplicate, duplicate: "merge" });
    expect(items[0]?.quantity).toBe(4);
    await writeCart({ action: "add", item: duplicate, duplicate: "separate" });
    expect(items).toHaveLength(2);
  });
  it("단위가 다른 merge를 거부하고 원래 수량을 유지해요", async () => {
    await add();
    const original = structuredClone(items);
    await expect(
      writeCart({
        action: "add",
        item: input({ unit_id: meta.units[1]!.id }),
        duplicate: "merge",
      }),
    ).rejects.toMatchObject({ code: "cart_unit_mismatch" });
    expect(items).toEqual(original);
  });
  it("체크한 사람을 기록하고 체크를 풀면 초기화해요", async () => {
    const item = await add();
    state.perspective = 1;
    await writeCart({ action: "check", id: item.id, checked: true });
    expect(items[0]).toMatchObject({ is_checked: true, checked_by: partnerId });
    await writeCart({ action: "check", id: item.id, checked: false });
    expect(items[0]).toMatchObject({ is_checked: false, checked_by: null });
  });
  it("clear-checked는 보낸 id 중 체크된 활성 항목만 삭제해요", async () => {
    const remove = await checked();
    const keep = await checked();
    const unchecked = await add();
    await writeCart({
      action: "clear-checked",
      ids: [remove.id, unchecked.id],
    });
    expect(items.map((item) => item.id)).toEqual([keep.id, unchecked.id]);
    await writeCart({ action: "delete", id: unchecked.id });
    expect(items).toHaveLength(1);
  });
});
describe("CART-04 SCN-CART-2 코너 순서", () => {
  it("모든 코너를 한 번씩 보내야 순서를 바꿔요", async () => {
    const ids = meta.categories.map((category) => category.id).reverse();
    const before = structuredClone(meta);
    for (const invalid of [
      ids.slice(1),
      ids.map(() => ids[0]!),
      [...ids.slice(1), crypto.randomUUID()],
    ])
      await expect(
        writeCart({ action: "order", ids: invalid }),
      ).rejects.toMatchObject({ code: "invalid_cart" });
    expect(meta).toEqual(before);
    await writeCart({ action: "order", ids });
    expect(meta.categories.map((category) => category.id)).toEqual(ids);
    expect(meta.categories.map((category) => category.sort_order)).toEqual(
      ids.map((_, index) => index),
    );
  });
});
describe("CART-07 CART-08 CART-09 INV-12 SCN-CART-4 구매 반영", () => {
  it("기존 수량에 더하고 새 품목은 등록하며 상태 품목은 충분으로 바꿔요", async () => {
    const stock = inventory.find((item) => item.mode === "quantity")!;
    const status = inventory.find((item) => item.mode === "status")!;
    const quantity = stock.quantity;
    const existingCart = await checked({
      inventory_item_id: stock.id,
      name: stock.name,
    });
    const newCart = await checked();
    const statusCart = await checked({
      inventory_item_id: status.id,
      name: status.name,
    });
    const entries = [
      entry(existingCart.id, { unit_id: stock.unit_id! }),
      entry(newCart.id),
      entry(statusCart.id),
    ];
    const result = await writeCart({ action: "restock", entries });
    expect(result.results).toHaveLength(3);
    expect(inventory.find((item) => item.id === stock.id)?.quantity).toBe(
      quantity + 2,
    );
    expect(inventory.find((item) => item.name === "새 두부")?.quantity).toBe(2);
    expect(inventory.find((item) => item.id === status.id)?.status).toBe(
      "enough",
    );
    expect((await listCart()).items).toHaveLength(0);
    expect(items.every((item) => !!item.purchased_at)).toBe(true);
    await expect(
      writeCart({ action: "restock", entries }),
    ).rejects.toMatchObject({ code: "cart_changed" });
  });
  it("같은 이름 새 품목의 단위를 첫 항목으로 맞춰 보내면 하나의 재고에 더해요", async () => {
    const first = await checked();
    const second = await checked({
      name: "새두부",
      unit_id: meta.units[1]!.id,
    });
    await writeCart({
      action: "restock",
      entries: [entry(first.id), entry(second.id)],
    });
    const stocks = inventory.filter(
      (item) => normalizeItemName(item.name) === "새두부",
    );
    expect(stocks).toHaveLength(1);
    expect(stocks[0]).toMatchObject({
      quantity: 4,
      unit_id: meta.units[0]!.id,
    });
  });
  it("뒤 항목의 단위가 다르면 앞 항목도 반영하지 않아요", async () => {
    const first = await checked();
    const second = await checked();
    const before = structuredClone({ inventory, items });
    await expect(
      writeCart({
        action: "restock",
        entries: [
          entry(first.id),
          entry(second.id, { unit_id: meta.units[1]!.id }),
        ],
      }),
    ).rejects.toMatchObject({ code: "cart_unit_mismatch" });
    expect({ inventory, items }).toEqual(before);
  });
  it("배우자가 체크를 푼 항목이나 잘못된 장소가 있으면 전부 유지해요", async () => {
    const first = await checked();
    const second = await checked();
    await writeCart({ action: "check", id: second.id, checked: false });
    const before = structuredClone({ inventory, items });
    await expect(
      writeCart({
        action: "restock",
        entries: [entry(first.id), entry(second.id)],
      }),
    ).rejects.toMatchObject({ code: "cart_changed" });
    await expect(
      writeCart({
        action: "restock",
        entries: [entry(first.id, { location_id: crypto.randomUUID() })],
      }),
    ).rejects.toMatchObject({ code: "invalid_cart" });
    expect({ inventory, items }).toEqual(before);
  });
  it("SCN-CART-5 확인만 하고 반영하지 않으면 재고와 체크 항목을 유지해요", async () => {
    await checked();
    const before = structuredClone({ inventory, items });
    expect((await listCart()).items).toHaveLength(1);
    expect({ inventory, items }).toEqual(before);
  });
});
describe("CART-05 SCN-CART-6 구매 기록 응답", () => {
  it("활성 항목은 생성 순이며 자주 사는 품목은 최신 구매의 정보를 써요", async () => {
    const first = await add({ name: "먼저" });
    const second = await add({ name: "나중" });
    first.created_at = "2026-01-01T00:00:00Z";
    second.created_at = "2026-01-02T00:00:00Z";
    const old = await checked({ memo: "오래된 메모" });
    const recent = await checked({
      memo: "최신 메모",
      link_url: "https://example.com/new",
    });
    old.purchased_at = "2026-01-01T00:00:00Z";
    recent.purchased_at = new Date().toISOString();
    const result = await listCart();
    expect(result.items.map((item) => item.id)).toEqual([first.id, second.id]);
    expect(result.frequent).toHaveLength(1);
    expect(result.frequent[0]).toMatchObject({
      id: recent.id,
      memo: "최신 메모",
      link_url: "https://example.com/new",
    });
  });
});
describe("DEC-010 CART-12 이름 정규화 계약", () => {
  it("SQL의 공백 문자 집합과 JS의 판정이 모든 기본 다국어 문자에서 같아요", () => {
    // Checks the SQL expression's contract without claiming to execute PostgreSQL or its locale rules.
    const sql = readFileSync(
      "supabase/migrations/20261026000000_cart.sql",
      "utf8",
    );
    const expression = sql.match(
      /select lower\(regexp_replace\(value,\s*U&'([^']+)', '', 'g'\)\)/,
    );
    expect(expression).not.toBeNull();
    const sqlWhitespace = new RegExp(
      expression![1]!.replace(/\\([0-9A-F]{4})/g, "\\u$1"),
      "gu",
    );
    const alphabet = Array.from({ length: 0x10000 }, (_, code) =>
      String.fromCharCode(code),
    ).join("");
    expect(normalizeItemName(alphabet)).toBe(
      alphabet.replace(sqlWhitespace, "").toLocaleLowerCase("en-US"),
    );
    for (const name of [
      " Milk\tTEA ",
      "두\u00a0부",
      "\ufeffABC\u3000",
      "달걀\n1판",
    ])
      expect(normalizeItemName(name)).toBe(
        name.replace(sqlWhitespace, "").toLowerCase(),
      );
  });
});
