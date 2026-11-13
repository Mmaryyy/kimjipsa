import { cn } from "@/shared/lib";
import {
  InventoryStatusCapsule,
  InventoryBadges,
  type InventoryItem,
  type InventoryMeta,
} from "@/entities/inventory-item";
import { Pencil, PackageOpen, Trash2 } from "lucide-react";
import {
  Button,
  SwipeActionRow,
  Text,
  TextButton,
  QuantityStepper,
} from "@/shared/ui";
interface Props {
  item: InventoryItem;
  meta: InventoryMeta;
  pending: boolean;
  controlOpen: boolean;
  onControlOpenChange: (open: boolean) => void;
  groupBy: "locations" | "categories";
  onOpen: () => void;
  onEdit: () => void;
  onUsedUp: () => void;
  onDelete: () => void;
  onAdjust: (delta: number) => void;
  onStatus: (status: InventoryItem["status"]) => void;
}
const InventoryItemRow = ({
  item,
  meta,
  pending,
  controlOpen,
  onControlOpenChange,
  groupBy,
  onOpen,
  onEdit,
  onUsedUp,
  onDelete,
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
    <SwipeActionRow
      label={`${item.name} 동작`}
      actions={[
        <Button
          key="edit"
          size="icon-sm"
          variant="gray"
          aria-label={`${item.name} 수정`}
          disabled={pending}
          onClick={onEdit}
        >
          <Pencil aria-hidden />
        </Button>,
        <Button
          key="used-up"
          size="icon-sm"
          aria-label={`${item.name} 다 씀`}
          disabled={pending}
          onClick={onUsedUp}
        >
          <PackageOpen className="-scale-y-100" aria-hidden />
        </Button>,
        <Button
          key="delete"
          size="icon-sm"
          variant="danger"
          aria-label={`${item.name} 삭제`}
          disabled={pending}
          onClick={onDelete}
        >
          <Trash2 aria-hidden />
        </Button>,
      ]}
      disabled={pending}
      data-od-id={`inv-item-${item.id}`}
      aria-busy={pending}
      contentClassName="flex min-h-[var(--row-min)] items-center gap-2 py-2"
    >
      {(contentDisabled) => (
        <>
          <TextButton
            disabled={contentDisabled}
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
                  disabled={contentDisabled}
                  collapsible={{
                    open: controlOpen,
                    onOpenChange: onControlOpenChange,
                  }}
                  allowDirectInput
                  label={item.name}
                  unit={unit}
                  value={item.quantity}
                  onValueChange={(next) => onAdjust(next - item.quantity)}
                />
              </div>
            </>
          ) : (
            <InventoryStatusCapsule
              label={item.name}
              value={item.status}
              open={controlOpen}
              onOpenChange={onControlOpenChange}
              onValueChange={onStatus}
            />
          )}
        </>
      )}
    </SwipeActionRow>
  );
};
export default InventoryItemRow;
