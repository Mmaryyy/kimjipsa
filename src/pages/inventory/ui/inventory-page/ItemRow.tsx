import { cn } from "@/shared/lib";
import { inventoryStatusControlStyles } from "./inventory-item-row.variants";
import {
  inventoryStatusOptions,
  InventoryBadges,
  type InventoryItem,
  type InventoryMeta,
} from "@/entities/inventory-item";
import {
  Text,
  TextButton,
  QuantityStepper,
  SegmentedControl,
} from "@/shared/ui";
interface Props {
  item: InventoryItem;
  meta: InventoryMeta;
  pending: boolean;
  groupBy: "locations" | "categories";
  onOpen: () => void;
  onAdjust: (delta: number) => void;
  onStatus: (status: InventoryItem["status"]) => void;
}
const InventoryItemRow = ({
  item,
  meta,
  pending,
  groupBy,
  onOpen,
  onAdjust,
  onStatus,
}: Props) => {
  const unit =
    meta.units.find((entry) => entry.id === item.unit_id)?.name ?? "";
  const category = meta.categories.find(
    (entry) => entry.id === item.category_id,
  )?.name;
  const location = meta.locations.find(
    (entry) => entry.id === item.location_id,
  )?.name;
  const description = [
    groupBy === "locations" ? category : location,
    item.expires_on && `~${item.expires_on.slice(5).replace("-", ".")}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li
      data-od-id={`inv-item-${item.id}`}
      aria-busy={pending}
      className="flex min-h-[var(--row-min)] items-center gap-2 py-2"
    >
      <TextButton
        className={cn(
          "min-h-0 min-w-0 flex-1 flex-col items-start justify-center gap-0",
          "text-left font-normal text-foreground",
        )}
        onClick={onOpen}
      >
        <span className="block max-w-full truncate text-body font-normal">
          {item.name}
        </span>
        <Text
          as="span"
          variant="caption"
          className="hidden text-muted-foreground min-[381px]:block"
        >
          {description}
        </Text>
      </TextButton>
      {item.mode === "quantity" ? (
        <>
          <InventoryBadges item={item} expiryDays={meta.expiry_days} />
          <div className="flex shrink-0 items-center gap-1">
            <QuantityStepper
              allowDirectInput
              label={item.name}
              unit={unit}
              value={item.quantity}
              onValueChange={(next) => onAdjust(next - item.quantity)}
            />
          </div>
        </>
      ) : (
        <SegmentedControl
          label={`${item.name} 상태`}
          options={inventoryStatusOptions}
          value={item.status}
          onValueChange={onStatus}
          className={inventoryStatusControlStyles({ state: item.status })}
        />
      )}
    </li>
  );
};
export default InventoryItemRow;
