import {
  InventoryBadges,
  type InventoryItem,
  type InventoryMeta,
} from "@/entities/inventory-item";
import { Button, List, ListRow, TextButton, Text } from "@/shared/ui";
interface Props {
  item: InventoryItem;
  meta: InventoryMeta;
  pending: boolean;
  onEdit: () => void;
  onUsedUp: () => void;
  onDelete: () => void;
}
const InventoryItemDetails = ({
  item,
  meta,
  pending,
  onEdit,
  onUsedUp,
  onDelete,
}: Props) => {
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
      <TextButton onClick={onEdit} data-od-id="item-edit">
        품목 수정
      </TextButton>
      <div className="mt-5 grid gap-3">
        <Button data-od-id="item-used-up" disabled={pending} onClick={onUsedUp}>
          다 썼어요
        </Button>
        <TextButton
          tone="danger"
          data-od-id="item-delete"
          disabled={pending}
          onClick={onDelete}
        >
          품목 삭제
        </TextButton>
      </div>
    </>
  );
};
export default InventoryItemDetails;
