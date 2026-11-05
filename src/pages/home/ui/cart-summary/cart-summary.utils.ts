import { tz } from "@date-fns/tz";
import { formatDistance } from "date-fns";
import { ko } from "date-fns/locale";
import { groupCartItems, type CartData } from "@/entities/cart-item";
import type { InventoryMeta } from "@/entities/inventory-item";

export function cartSummary(
  data: CartData,
  meta: InventoryMeta,
  instant: Date,
) {
  const active = data.items.filter((item) => !item.purchased_at);
  const checked = active.filter((item) => item.is_checked);
  const latest = checked
    .filter((item) => item.checked_at)
    .sort((a, b) => Date.parse(b.checked_at!) - Date.parse(a.checked_at!))[0];
  let activity: string | undefined;
  if (latest) {
    const member = data.members.find(
      (row) => row.user_id === latest.checked_by,
    );
    const actor =
      latest.checked_by === data.actorId
        ? "내가"
        : `${member?.display_name ?? "탈퇴한 사용자"} 님이`;
    const checkedAt = new Date(
      Math.min(Date.parse(latest.checked_at!), instant.getTime()),
    );
    const elapsed =
      instant.getTime() - checkedAt.getTime() < 60_000
        ? "방금"
        : `${formatDistance(checkedAt, instant, {
            locale: ko,
            addSuffix: true,
            in: tz("Asia/Seoul"),
          })}에`;
    const last = latest.name.charCodeAt(latest.name.length - 1);
    const particle =
      last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 ? "을" : "를";
    activity = `${actor} ${elapsed} ${latest.name}${particle} 담았어요`;
  }
  const groups = groupCartItems(
    active.filter((item) => !item.is_checked),
    meta.categories,
  ).flatMap((category) => {
    const { items } = category;
    if (!items.length) return [];
    const text = items
      .map((item) => {
        const unit =
          meta.units.find((row) => row.id === item.unit_id)?.name ?? "";
        return `${item.name} ${item.quantity}${unit}`;
      })
      .join(" · ");
    return [{ id: category.id, name: category.name, text }];
  });
  return {
    total: active.length,
    checked: checked.length,
    activity,
    groups: groups.slice(0, 3),
    remaining: Math.max(0, groups.length - 3),
  };
}
