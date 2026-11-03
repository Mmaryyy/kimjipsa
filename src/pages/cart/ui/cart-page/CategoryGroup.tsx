import type { CartItem, CartCommand, CartData } from "@/entities/cart-item";
import type { InventoryMeta } from "@/entities/inventory-item";
import { GroupLabel, List } from "@/shared/ui";
import CartItemRow from "./Row";
interface Props {
  category: { id: string; name: string };
  index: number;
  categories: { id: string }[];
  otherId: string;
  items: CartItem[];
  units: InventoryMeta["units"];
  members: CartData["members"];
  pending: boolean;
  busy: boolean;
  pendingIds: (string | null)[];
  openedRow: string | null;
  onOpenedRowChange: (id: string | null) => void;
  onProcessItems: (items: CartItem[]) => Promise<void>;
  onWrite: (command: CartCommand) => Promise<void>;
  onEdit: (item: CartItem) => void;
}
const CartCategoryGroup = ({
  category,
  index,
  categories,
  otherId,
  items,
  units,
  members,
  pending,
  busy,
  pendingIds,
  openedRow,
  onOpenedRowChange,
  onProcessItems,
  onWrite,
  onEdit,
}: Props) => {
  const rows = items.filter(
    (item) =>
      (categories.some((entry) => entry.id === item.category_id)
        ? item.category_id
        : otherId) === category.id,
  );
  if (!rows.length) return null;
  return (
    <section>
      <GroupLabel as="h2" data-od-id={`corner-${index}`}>
        {category.name}
      </GroupLabel>
      <List>
        {rows.map((item) => (
          <CartItemRow
            key={item.id}
            item={item}
            index={items.indexOf(item)}
            unit={units.find((entry) => entry.id === item.unit_id)?.name ?? ""}
            checkedBy={
              members.find((member) => member.user_id === item.checked_by)
                ?.display_name ?? "탈퇴한 사용자"
            }
            open={openedRow === item.id && !pending}
            onOpenChange={(open) => onOpenedRowChange(open ? item.id : null)}
            onPurchase={() => void onProcessItems([item])}
            onQuantityChange={(quantity) => {
              if (quantity !== item.quantity)
                void onWrite({
                  action: "save",
                  id: item.id,
                  item: { ...item, quantity },
                });
            }}
            disabled={busy}
            pending={pendingIds.includes(item.id)}
            onCheck={() =>
              void onWrite({
                action: "check",
                id: item.id,
                checked: !item.is_checked,
              })
            }
            onEdit={() => onEdit(item)}
            onDelete={() => void onWrite({ action: "delete", id: item.id })}
          />
        ))}
      </List>
    </section>
  );
};
export default CartCategoryGroup;
