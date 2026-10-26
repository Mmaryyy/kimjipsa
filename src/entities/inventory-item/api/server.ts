import "server-only";
import { z } from "zod";
import { ApiError, type Json } from "@/shared/api";
import {
  createServerSupabaseClient,
  mockContext,
  mockJson,
  throwDatabaseError,
} from "@/shared/server";
import {
  inventoryItemSchema,
  inventoryInputSchema,
  inventoryMetaSchema,
  inventoryKindSchema,
  inventoryMetaInputSchema,
} from "../model/inventory.schema";
const errors = {
  unauthorized: [401, "로그인이 필요해요."],
  family_required: [403, "가정에 먼저 참여해 주세요."],
  inventory_not_found: [404, "품목이나 목록을 찾을 수 없어요."],
  invalid_inventory: [400, "입력 내용을 확인해 주세요."],
  quantity_required: [400, "수량으로 관리하는 품목만 더할 수 있어요."],
  unit_in_use: [
    409,
    "이 단위를 쓰는 품목의 단위를 먼저 바꾼 뒤 삭제해 주세요.",
  ],
  inventory_meta_duplicate: [409, "같은 이름의 목록이 있어요."],
} as const;
const id = z.uuid().nullable().optional();
const itemCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), id, item: inventoryInputSchema }),
  z.object({ action: z.enum(["delete", "used-up"]), id: z.uuid() }),
  z.object({
    action: z.literal("status"),
    id: z.uuid(),
    status: inventoryItemSchema.shape.status,
  }),
  z.object({
    action: z.literal("adjust"),
    id: z.uuid(),
    delta: z.number().finite(),
  }),
  z.object({
    action: z.literal("merge"),
    id: z.uuid(),
    delta: z.number().finite().nonnegative(),
  }),
]);
const metaCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    kind: inventoryKindSchema,
    id,
    entry: inventoryMetaInputSchema,
  }),
  z.object({
    action: z.literal("delete"),
    kind: inventoryKindSchema,
    id: z.uuid(),
  }),
  z.object({ action: z.literal("reset"), kind: inventoryKindSchema }),
  z.object({
    action: z.literal("expiry"),
    days: z.number().int().min(0).max(30),
  }),
]);
async function inventoryContext() {
  const client = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (!user || error)
    throw new ApiError("unauthorized", "로그인이 필요해요.", 401);
  const membership = await client
    .from("memberships")
    .select("family_id")
    .eq("user_id", user.id)
    .maybeSingle();
  throwDatabaseError(membership.error, errors);
  if (!membership.data)
    throw new ApiError("family_required", "가정에 먼저 참여해 주세요.", 403);
  return { client, familyId: membership.data.family_id };
}
export async function listInventory() {
  if (await mockContext()) return mockJson("inventory-items");
  const { client, familyId } = await inventoryContext();
  const result = await client
    .from("inventory_items")
    .select("*")
    .eq("family_id", familyId)
    .order("name");
  throwDatabaseError(result.error, errors);
  return z.array(inventoryItemSchema).parse(result.data);
}
export async function listInventoryMeta() {
  if (await mockContext()) return mockJson("inventory-meta");
  const { client, familyId } = await inventoryContext();
  const [categories, locations, units, family] = await Promise.all([
    client
      .from("inventory_categories")
      .select("*")
      .eq("family_id", familyId)
      .order("sort_order"),
    client
      .from("locations")
      .select("*")
      .eq("family_id", familyId)
      .order("sort_order"),
    client
      .from("units")
      .select("*")
      .eq("family_id", familyId)
      .order("sort_order"),
    client.from("families").select("expiry_days").eq("id", familyId).single(),
  ]);
  for (const result of [categories, locations, units, family])
    throwDatabaseError(result.error, errors);
  return inventoryMetaSchema.parse({
    categories: categories.data,
    locations: locations.data,
    units: units.data,
    expiry_days: family.data?.expiry_days,
  });
}
export async function writeInventory(raw: unknown) {
  const command = itemCommand.parse(raw);
  if (!(await mockContext())) {
    const { client } = await inventoryContext();
    const result = await client.rpc("write_inventory", {
      payload: command as Json,
    });
    throwDatabaseError(result.error, errors);
    return result.data;
  }
  const items = await mockJson("inventory-items");
  const index = command.id
    ? items.findIndex((item) => item.id === command.id)
    : -1;
  if (command.id && index < 0)
    throw new ApiError("inventory_not_found", "품목을 찾을 수 없어요.", 404);
  if (command.action === "save") {
    const meta = await mockJson("inventory-meta");
    const fields = [
      ["unit_id", "units"],
      ["category_id", "categories"],
      ["location_id", "locations"],
    ] as const;
    for (const [field, kind] of fields) {
      const value = command.item[field];
      if (
        value &&
        !meta[kind].some(
          (entry) =>
            entry.id === value &&
            (kind !== "locations" ||
              entry.enabled ||
              items[index]?.location_id === value),
        )
      )
        throw new ApiError("invalid_inventory", "목록을 다시 선택해 주세요.");
    }
    const saved = { ...command.item, id: command.id ?? crypto.randomUUID() };
    if (index < 0) items.push(saved);
    else items[index] = saved;
    return saved.id;
  }
  const item = items[index]!;
  if (command.action === "delete") items.splice(index, 1);
  else if (command.action === "status") {
    if (item.mode !== "status")
      throw new ApiError(
        "invalid_inventory",
        "상태로 관리하는 품목만 바꿀 수 있어요.",
      );
    item.status = command.status;
  } else if (command.action === "used-up") {
    if (item.mode === "quantity") item.quantity = 0;
    else item.status = "none";
  } else if (command.action === "adjust" || command.action === "merge") {
    if (item.mode !== "quantity")
      throw new ApiError(
        "quantity_required",
        "수량으로 관리하는 품목만 더할 수 있어요.",
      );
    item.quantity = Math.max(0, item.quantity + command.delta);
  }
  return item.id;
}
export async function writeInventoryMeta(raw: unknown) {
  const command = metaCommand.parse(raw);
  if (!(await mockContext())) {
    const { client } = await inventoryContext();
    const result = await client.rpc("write_inventory_meta", {
      payload: command as Json,
    });
    throwDatabaseError(result.error, errors);
    return null;
  }
  const meta = await mockJson("inventory-meta");
  if (command.action === "expiry") {
    meta.expiry_days = command.days;
    return null;
  }
  const entries = meta[command.kind];
  const items = await mockJson("inventory-items");
  const target = "id" in command ? command.id : null;
  const index = target ? entries.findIndex((entry) => entry.id === target) : -1;
  if (target && index < 0)
    throw new ApiError("inventory_not_found", "목록을 찾을 수 없어요.", 404);
  if (
    command.action === "delete" &&
    command.kind === "categories" &&
    entries[index]?.name === "기타"
  )
    throw new ApiError(
      "invalid_inventory",
      "기타 카테고리는 삭제할 수 없어요.",
    );
  if (command.action === "save") {
    if (
      entries.some(
        (entry) => entry.id !== target && entry.name === command.entry.name,
      )
    )
      throw new ApiError(
        "inventory_meta_duplicate",
        "같은 이름의 목록이 있어요.",
        409,
      );
    const saved = { ...command.entry, id: target ?? crypto.randomUUID() };
    if (index < 0) entries.push(saved);
    else entries[index] = saved;
  } else if (command.action === "delete") {
    if (
      command.kind === "units" &&
      items.some((item) => item.unit_id === target)
    )
      throw new ApiError("unit_in_use", errors.unit_in_use[1], 409);
    if (command.kind === "categories") {
      let other = entries.find((entry) => entry.name === "기타");
      if (!other) {
        const defaults = await mockJson("inventory-defaults");
        other = {
          ...defaults.categories.find((entry) => entry.name === "기타")!,
          id: crypto.randomUUID(),
        };
        entries.push(other);
      }
      for (const item of items) {
        if (item.category_id === target) item.category_id = other.id;
      }
    }
    if (command.kind === "locations")
      for (const item of items) {
        if (item.location_id === target) item.location_id = null;
      }
    entries.splice(index, 1);
  } else {
    const defaults = await mockJson("inventory-defaults");
    const restored = defaults[command.kind].map((entry) => ({
      ...entry,
      id:
        entries.find((saved) => saved.name === entry.name)?.id ??
        crypto.randomUUID(),
    }));
    if (command.kind === "categories") {
      const other = restored.find((entry) => entry.name === "기타")!;
      for (const item of items) {
        if (
          item.category_id &&
          !restored.some((entry) => entry.id === item.category_id)
        )
          item.category_id = other.id;
      }
    }
    const retained = entries
      .filter(
        (entry) =>
          !restored.some((saved) => saved.id === entry.id) &&
          (command.kind === "locations" ||
            (command.kind === "units" &&
              items.some((item) => item.unit_id === entry.id))),
      )
      .map((entry) => ({ ...entry, enabled: true }));
    meta[command.kind] = [...restored, ...retained];
  }
  return null;
}
