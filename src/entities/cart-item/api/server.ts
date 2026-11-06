import "server-only";
import { z } from "zod";
import { ApiError, type Json } from "@/shared/api";
import { compareItemNames, normalizeItemName } from "@/shared/lib";
import {
  createServerSupabaseClient,
  mockContext,
  mockJson,
  throwDatabaseError,
} from "@/shared/server";
import {
  cartCommandSchema,
  cartItemSchema,
  frequentOverrideSchema,
} from "../model/cart.schema";
import { frequentCartItems, resolveFrequentCartItems } from "../lib/cart.utils";
import type { CartData, CartWriteResult } from "./type";
import { addWithCategory } from "./category.server";
const errors = {
  unauthorized: [401, "로그인이 필요해요."],
  family_required: [403, "가정에 먼저 참여해 주세요."],
  cart_not_found: [404, "장바구니 항목을 찾을 수 없어요."],
  cart_changed: [
    409,
    "담은 항목이 바뀌었어요. 장바구니에서 다시 확인해 주세요.",
  ],
  restock_undo_unavailable: [
    409,
    "다른 변경이 있거나 되돌릴 수 있는 시간이 지났어요. 현재 상태는 그대로 유지해요.",
  ],
  invalid_cart: [400, "품목과 목록을 다시 확인해 주세요."],
  cart_unit_mismatch: [
    409,
    "단위가 달라요. 같은 단위의 수량으로 바꾸거나 따로 추가해 주세요.",
  ],
} as const;
async function cartContext() {
  const client = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    throw new ApiError("unauthorized", errors.unauthorized[1], 401);
  const membership = await client
    .from("memberships")
    .select("family_id")
    .eq("user_id", user.id)
    .maybeSingle();
  throwDatabaseError(membership.error, errors);
  if (!membership.data)
    throw new ApiError("family_required", errors.family_required[1], 403);
  return { client, familyId: membership.data.family_id, actorId: user.id };
}
export async function listCart(): Promise<CartData> {
  const mock = await mockContext();
  if (mock) {
    const family = await mockJson("family");
    const items = await mockJson("cart-items");
    const meta = await mockJson("inventory-meta");
    return {
      items: items
        .filter((item) => !item.purchased_at)
        .sort(
          (a, b) =>
            a.created_at.localeCompare(b.created_at) ||
            a.id.localeCompare(b.id),
        ),
      ...resolveFrequentCartItems(
        frequentCartItems(items, Date.now(), Infinity),
        z
          .array(frequentOverrideSchema)
          .parse(mock.values.get("frequent-overrides") ?? []),
        meta.units,
        meta.categories,
      ),
      familyId: family.id,
      actorId: family.members[mock.perspective]!.user_id,
      members: family.members,
    };
  }
  const { client, familyId, actorId } = await cartContext();
  const [items, members, frequent, overrides, units, categories] =
    await Promise.all([
      client
        .from("cart_items")
        .select("*")
        .eq("family_id", familyId)
        .is("purchased_at", null)
        .order("created_at")
        .order("id"),
      client.rpc("family_members"),
      client.rpc("frequent_cart_items"),
      client
        .from("frequent_cart_overrides")
        .select("*")
        .eq("family_id", familyId),
      client.from("units").select("id,name").eq("family_id", familyId),
      client
        .from("inventory_categories")
        .select("id,name")
        .eq("family_id", familyId),
    ]);
  throwDatabaseError(items.error, errors);
  throwDatabaseError(members.error, errors);
  throwDatabaseError(frequent.error, errors);
  for (const result of [overrides, units, categories])
    throwDatabaseError(result.error, errors);
  return {
    items: z.array(cartItemSchema).parse(items.data),
    ...resolveFrequentCartItems(
      z.array(cartItemSchema).parse(frequent.data),
      z.array(frequentOverrideSchema).parse(
        (overrides.data ?? []).map((row) => ({
          ...row,
          name: row.normalized_name,
        })),
      ),
      units.data ?? [],
      categories.data ?? [],
    ),
    familyId,
    actorId,
    members: members.data ?? [],
  };
}
export async function writeCart(raw: unknown): Promise<CartWriteResult> {
  const command = cartCommandSchema.parse(raw);
  const mock = await mockContext();
  if (!mock) {
    const { client } = await cartContext();
    if (command.action === "add" && command.autoCategory)
      return addWithCategory(client, command);
    if (command.action === "save-frequent") {
      const result = await client.rpc("save_frequent_cart_override", {
        payload: command.item as Json,
      });
      throwDatabaseError(result.error, errors);
      return {};
    }
    const result =
      command.action === "undo-restock"
        ? await client.rpc("undo_cart_restock", { token: command.token })
        : await client.rpc("write_cart", { payload: command as Json });
    throwDatabaseError(result.error, errors);
    return result.data as CartWriteResult;
  }
  // Complete all asynchronous reads before mutating this shared session. Checkout commits cloned state only on success.
  const [items, inventory, meta, family] = await Promise.all([
    mockJson("cart-items"),
    mockJson("inventory-items"),
    mockJson("inventory-meta"),
    mockJson("family"),
  ]);
  if (command.action === "save-frequent") {
    const input = command.item;
    if (
      (input.unit_id &&
        !meta.units.some((entry) => entry.id === input.unit_id)) ||
      (input.category_id &&
        !meta.categories.some((entry) => entry.id === input.category_id))
    )
      throw new ApiError("invalid_cart", errors.invalid_cart[1]);
    const overrides = z
      .array(frequentOverrideSchema)
      .parse(mock.values.get("frequent-overrides") ?? []);
    const key = normalizeItemName(input.name);
    mock.values.set("frequent-overrides", [
      ...overrides.filter((entry) => normalizeItemName(entry.name) !== key),
      {
        ...overrides.find((entry) => normalizeItemName(entry.name) === key),
        ...input,
        name: key,
      },
    ]);
    return {};
  }
  if (command.action === "add" && command.autoCategory) {
    const normalized = normalizeItemName(command.item.name);
    const stock = inventory.find(
      (item) => normalizeItemName(item.name) === normalized && item.category_id,
    );
    const purchase = items
      .filter((item) => item.purchased_at && item.category_id)
      .sort((a, b) => b.purchased_at!.localeCompare(a.purchased_at!))
      .find((item) => normalizeItemName(item.name) === normalized);
    command.item.category_id =
      stock?.category_id ??
      purchase?.category_id ??
      meta.categories.find((entry) => entry.name === "기타")?.id ??
      null;
  }
  const actor = family.members[mock.perspective]!.user_id;
  const undoKey = "cart-restock-undo";
  if (command.action === "undo-restock") {
    const undo = mock.values.get(undoKey) as
      | {
          token: string;
          actor: string;
          expires: number;
          before: { items: typeof items; inventory: typeof inventory };
          after: string;
        }
      | undefined;
    if (
      !undo ||
      undo.token !== command.token ||
      undo.actor !== actor ||
      undo.expires < Date.now() ||
      undo.after !== JSON.stringify({ items, inventory, meta })
    )
      throw new ApiError(
        "restock_undo_unavailable",
        errors.restock_undo_unavailable[1],
        409,
      );
    mock.values.delete(undoKey);
    items.splice(0, items.length, ...undo.before.items);
    inventory.splice(0, inventory.length, ...undo.before.inventory);
    return {};
  }
  const active = items.filter((item) => !item.purchased_at);
  const current =
    "id" in command ? active.find((item) => item.id === command.id) : undefined;
  if ("id" in command && !current)
    throw new ApiError("cart_not_found", errors.cart_not_found[1], 404);
  const invalid = () => {
    throw new ApiError("invalid_cart", errors.invalid_cart[1]);
  };
  if (command.action === "add" || command.action === "save") {
    const input = command.item;
    if (
      input.unit_id &&
      !meta.units.some((entry) => entry.id === input.unit_id)
    )
      invalid();
    if (
      input.category_id &&
      !meta.categories.some((entry) => entry.id === input.category_id)
    )
      invalid();
    if (
      input.inventory_item_id &&
      !inventory.some((entry) => entry.id === input.inventory_item_id)
    )
      invalid();
    if (command.action === "add") {
      const duplicate = active
        .sort((a, b) => a.id.localeCompare(b.id))
        .find((item) => compareItemNames(item.name, input.name) === "same");
      if (duplicate && command.duplicate === "ask") return { duplicate };
      if (duplicate && command.duplicate === "merge") {
        if (duplicate.unit_id !== input.unit_id)
          throw new ApiError(
            "cart_unit_mismatch",
            errors.cart_unit_mismatch[1],
            409,
          );
        mock.values.delete(undoKey);
        duplicate.quantity += input.quantity;
        return {};
      }
      mock.values.delete(undoKey);
      items.push({
        ...input,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        added_by: actor,
        checked_by: null,
        checked_at: null,
        is_checked: false,
        purchased_at: null,
      });
      return { item: items[items.length - 1] };
    } else {
      mock.values.delete(undoKey);
      Object.assign(current!, input);
    }
  } else if (command.action === "check") {
    if (current!.is_checked === command.checked) return {};
    mock.values.delete(undoKey);
    current!.is_checked = command.checked;
    current!.checked_by = command.checked ? actor : null;
    current!.checked_at = command.checked ? new Date().toISOString() : null;
  } else if (
    command.action === "delete" ||
    command.action === "clear-checked" ||
    command.action === "delete-selected"
  ) {
    const remove =
      command.action === "delete"
        ? [command.id]
        : active
            .filter(
              (item) =>
                (command.action === "delete-selected" || item.is_checked) &&
                command.ids.includes(item.id),
            )
            .map((item) => item.id);
    if (remove.length) mock.values.delete(undoKey);
    for (let i = items.length - 1; i >= 0; i--)
      if (remove.includes(items[i]!.id)) items.splice(i, 1);
  } else if (command.action === "order") {
    if (
      new Set(command.ids).size !== meta.categories.length ||
      command.ids.length !== meta.categories.length ||
      command.ids.some(
        (id) => !meta.categories.some((entry) => entry.id === id),
      )
    )
      invalid();
    mock.values.delete(undoKey);
    meta.categories.forEach((entry) => {
      entry.sort_order = command.ids.indexOf(entry.id);
    });
    meta.categories.sort((a, b) => a.sort_order - b.sort_order);
  } else {
    if (
      new Set(command.entries.map((entry) => entry.id)).size !==
      command.entries.length
    )
      invalid();
    const nextInventory = structuredClone(inventory);
    const nextItems = structuredClone(items);
    const results: NonNullable<CartWriteResult["results"]> = [];
    for (const entry of command.entries) {
      const cart = nextItems.find(
        (item) => item.id === entry.id && !item.purchased_at && item.is_checked,
      );
      if (!cart)
        throw new ApiError("cart_changed", errors.cart_changed[1], 409);
      let stock = nextInventory
        .sort((a, b) => a.id.localeCompare(b.id))
        .find((item) =>
          cart.inventory_item_id
            ? item.id === cart.inventory_item_id
            : compareItemNames(item.name, cart.name) === "same",
        );
      if (
        !meta.units.some((item) => item.id === entry.unit_id) ||
        !meta.categories.some((item) => item.id === entry.category_id) ||
        !meta.locations.some(
          (item) =>
            item.id === entry.location_id &&
            (item.enabled || item.id === stock?.location_id),
        )
      )
        invalid();
      if (stock) {
        if (stock.mode === "quantity" && stock.unit_id !== entry.unit_id)
          throw new ApiError(
            "cart_unit_mismatch",
            errors.cart_unit_mismatch[1],
            409,
          );
        if (stock.mode === "quantity") stock.quantity += entry.quantity;
        stock.status = "enough";
        stock.location_id = entry.location_id;
        stock.expires_on = entry.expires_on;
      } else {
        stock = {
          id: crypto.randomUUID(),
          name: cart.name,
          mode: "quantity",
          quantity: entry.quantity,
          status: "enough",
          unit_id: entry.unit_id,
          category_id: entry.category_id,
          location_id: entry.location_id,
          expires_on: entry.expires_on,
          min_quantity: null,
        };
        nextInventory.push(stock);
      }
      cart.purchased_at = new Date().toISOString();
      cart.inventory_item_id = stock.id;
      results.push({
        name: stock.name,
        quantity: stock.quantity,
        status: stock.status,
        unit_id: stock.unit_id,
      });
    }
    const undoToken = crypto.randomUUID();
    mock.values.set(undoKey, {
      token: undoToken,
      actor,
      expires: Date.now() + 30_000,
      before: structuredClone({ items, inventory }),
      after: JSON.stringify({
        items: nextItems,
        inventory: nextInventory,
        meta,
      }),
    });
    inventory.splice(0, inventory.length, ...nextInventory);
    items.splice(0, items.length, ...nextItems);
    return { results, undoToken };
  }
  return {};
}
