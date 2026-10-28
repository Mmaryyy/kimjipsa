import { normalizeItemName } from "@/shared/lib";
import type { CartItem } from "../api/type";
export const recentPurchaseWindowMs = 90 * 86400000;
export function parseCartQuickInput(
  value: string,
  units: readonly { id: string; name: string }[],
) {
  const text = value.trim();
  const match = text.match(/^(.+?)\s*(\d+(?:\.\d+)?)\s*([^\d]*)$/u);
  const parsedUnit = units.find((unit) => unit.name === match?.[3]?.trim());
  const defaultUnit = units.find((unit) => unit.name === "개");
  // Unrecognized suffixes belong to the product name; do not cut names such as P7 공동 품목.
  if (
    match &&
    (parsedUnit || (!match[3]?.trim() && /\s\d+(?:\.\d+)?$/u.test(text)))
  ) {
    return {
      name: match[1]!.trim(),
      quantity: Number(match[2]),
      unit_id: (parsedUnit ?? defaultUnit)?.id ?? null,
    };
  }
  return { name: text, quantity: 1, unit_id: defaultUnit?.id ?? null };
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
