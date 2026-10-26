import { differenceInCalendarDays, parseISO } from "date-fns";
import { tz } from "@date-fns/tz";
import type { InventoryItem } from "../api/type";
export function inventoryState(item: InventoryItem) {
  if (item.mode === "status") return item.status;
  if (item.quantity === 0) return "none";
  return item.min_quantity !== null && item.quantity <= item.min_quantity
    ? "low"
    : "enough";
}
export function inventoryExpiring(
  item: InventoryItem,
  days: number,
  now = new Date(),
) {
  if (!item.expires_on || inventoryState(item) === "none") return false;
  const options = { in: tz("Asia/Seoul") };
  const remaining = differenceInCalendarDays(
    parseISO(item.expires_on, options),
    now,
    options,
  );
  return remaining <= days;
}
export function inventoryExpiryLabel(item: InventoryItem, now = new Date()) {
  if (!item.expires_on) return "";
  const options = { in: tz("Asia/Seoul") };
  const days = differenceInCalendarDays(
    parseISO(item.expires_on, options),
    now,
    options,
  );
  if (days < 0) return `${-days}일 지남`;
  if (days === 0) return "오늘까지";
  if (days === 1) return "내일까지";
  return `${days}일 남음`;
}
