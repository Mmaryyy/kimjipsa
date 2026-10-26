import {
  InventoryCategoryIcon,
  type InventoryItem,
  type InventoryMeta,
  type InventoryMetaEntry,
} from "@/entities/inventory-item";
import { GroupLabel, List } from "@/shared/ui";
import InventoryItemRow from "./ItemRow";
interface Props {
  entry: InventoryMetaEntry & { items: InventoryItem[] };
  meta: InventoryMeta;
  groupBy: "locations" | "categories";
  pendingIds: string[];
  onOpen: (item: InventoryItem) => void;
  onAdjust: (item: InventoryItem, delta: number) => void;
  onStatus: (item: InventoryItem, status: InventoryItem["status"]) => void;
}
const InventoryGroup = ({
  entry,
  meta,
  groupBy,
  pendingIds,
  onOpen,
  onAdjust,
  onStatus,
}: Props) => {
  const rows = entry.items.map((item) => (
    <InventoryItemRow
      key={item.id}
      item={item}
      meta={meta}
      groupBy={groupBy}
      pending={pendingIds.includes(item.id)}
      onOpen={() => onOpen(item)}
      onAdjust={(delta) => onAdjust(item, delta)}
      onStatus={(status) => onStatus(item, status)}
    />
  ));
  return (
    <section aria-labelledby={`inventory-group-${entry.id}`}>
      <GroupLabel
        as="h2"
        id={`inventory-group-${entry.id}`}
        className="flex items-center gap-2"
      >
        {groupBy === "categories" && <InventoryCategoryIcon category={entry} />}
        {entry.name}
      </GroupLabel>
      <List>{rows}</List>
    </section>
  );
};
export default InventoryGroup;
