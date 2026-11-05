import { normalizeItemName } from "@/shared/lib";
import type { CartInput, CartItem } from "../api/type";
export const recentPurchaseWindowMs = 90 * 86400000;
export function parseCartQuickInput(
  value: string,
  units: readonly { id: string; name: string }[],
): {
  name: string;
  quantity: number;
  unit_id: string | null;
  unknownUnit?: string;
} {
  const text = value.trim();
  const match = text.match(/^(.+?)\s*(\d+(?:\.\d+)?)\s*([^\d]*)$/u);
  const defaultUnit = units.find((unit) => unit.name === "개");
  if (!match)
    return { name: text, quantity: 1, unit_id: defaultUnit?.id ?? null };
  const unitName = match[3]?.trim() || undefined;
  const parsedUnit = units.find(
    (unit) => unit.name.toLowerCase() === unitName?.toLowerCase(),
  );
  if (!parsedUnit && !/\s\d+(?:\.\d+)?[\p{L}]*$/u.test(text))
    return { name: text, quantity: 1, unit_id: defaultUnit?.id ?? null };
  const item = {
    name: match[1]!.trim(),
    quantity: Number(match[2]),
    unit_id: (parsedUnit ?? defaultUnit)?.id ?? null,
  };
  return unitName && !parsedUnit ? { ...item, unknownUnit: unitName } : item;
}
export function frequentCartItems(items: CartItem[], now = Date.now()) {
  const groups = new Map<
    string,
    { item: CartItem; purchases: number; recentPurchases: number }
  >();
  for (const item of items) {
    if (!item.purchased_at) continue;
    const key = normalizeItemName(item.name);
    const previous = groups.get(key);
    groups.set(key, {
      item:
        !previous ||
        Date.parse(item.purchased_at) > Date.parse(previous.item.purchased_at!)
          ? item
          : previous.item,
      purchases: (previous?.purchases ?? 0) + 1,
      recentPurchases:
        (previous?.recentPurchases ?? 0) +
        Number(Date.parse(item.purchased_at) >= now - recentPurchaseWindowMs),
    });
  }
  return [...groups.values()]
    .filter(({ purchases }) => purchases >= 2)
    .sort(
      (a, b) =>
        b.recentPurchases - a.recentPurchases ||
        a.item.name.localeCompare(b.item.name, "ko"),
    )
    .slice(0, 10)
    .map(({ item }) => item);
}

export function withFrequentCartDefaults(
  items: CartInput[],
  units: readonly { id: string; name: string }[] = [],
): CartInput[] {
  const names = new Set(items.map((item) => normalizeItemName(item.name)));
  const defaults = [
    { name: "휴지", unit: "팩", memo: "" },
    { name: "변기 세정제", unit: "팩", memo: "" },
    { name: "세탁세제", unit: "통", memo: "" },
    { name: "생수", unit: "번들", memo: "12개입" },
  ]
    .filter(({ name }) => !names.has(normalizeItemName(name)))
    .map(({ name, unit, memo }) => ({
      name,
      quantity: 1,
      unit_id: units.find((entry) => entry.name === unit)?.id ?? null,
      category_id: null,
      inventory_item_id: null,
      memo,
      link_url: "",
    }));
  return [...items, ...defaults].slice(0, 10);
}
