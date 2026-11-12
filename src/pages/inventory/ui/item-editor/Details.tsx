import { CartAddButton } from "@/features/cart-add";
import {
  InventoryBadges,
  inventoryState,
  type InventoryItem,
  type InventoryMeta,
} from "@/entities/inventory-item";
import { Button, List, ListRow, Text } from "@/shared/ui";
interface Props {
  item: InventoryItem;
  meta: InventoryMeta;
  pending: boolean;
  onUsedUp: () => void;
}
const InventoryItemDetails = ({ item, meta, pending, onUsedUp }: Props) => {
  const unit =
    meta.units.find((entry) => entry.id === item.unit_id)?.name ?? "";
  const description = [
    meta.locations.find((entry) => entry.id === item.location_id)?.name,
    meta.categories.find((entry) => entry.id === item.category_id)?.name,
  ]
    .filter(Boolean)
    .join(" · ");
  const rows =
    item.mode === "quantity"
      ? [
          { label: "수량", value: `${item.quantity} ${unit}` },
          {
            label: "최소 수량",
            value:
              item.min_quantity === null
                ? "없음"
                : `${item.min_quantity} ${unit}`,
          },
        ]
      : [{ label: "관리 방식", value: "상태로만" }];
  const canAdd = inventoryState(item) !== "enough";
  return (
    <>
      <div className="py-4">
        <Text as="h3" variant="title">
          {item.name}
        </Text>
        <div className="flex flex-wrap items-center gap-2 text-body-sm text-muted-foreground">
          {description}
          <InventoryBadges item={item} expiryDays={meta.expiry_days} />
        </div>
      </div>
      <List>
        {[
          ...rows,
          {
            label: "유통기한",
            value: item.expires_on?.replaceAll("-", ".") ?? "없음",
          },
        ].map((row) => (
          <ListRow key={row.label} trailing={row.value}>
            {row.label}
          </ListRow>
        ))}
      </List>
      <div
        className={`mt-5 grid gap-3 ${canAdd ? "grid-cols-2" : "grid-cols-1"}`}
      >
        {canAdd ? (
          <Button
            variant="gray"
            data-od-id="item-used-up"
            disabled={pending}
            onClick={onUsedUp}
          >
            다 썼어요
          </Button>
        ) : (
          <Button
            data-od-id="item-used-up"
            disabled={pending}
            onClick={onUsedUp}
          >
            다 썼어요
          </Button>
        )}
        {canAdd && (
          <CartAddButton
            appearance="filled"
            item={{
              name: item.name,
              quantity: 1,
              unit_id: item.unit_id,
              category_id: item.category_id,
              inventory_item_id: item.id,
              memo: "",
              link_url: "",
            }}
          />
        )}
      </div>
    </>
  );
};
export default InventoryItemDetails;
