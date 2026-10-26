import { StatusBadge } from "@/shared/ui";
import {
  inventoryState,
  inventoryExpiring,
  inventoryExpiryLabel,
} from "../../lib/inventory.utils";
import type { InventoryItem } from "../../api/type";
interface Props {
  item: InventoryItem;
  expiryDays: number;
}
const InventoryBadges = ({ item, expiryDays }: Props) => {
  const state = inventoryState(item);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {state === "low" && <StatusBadge variant="warning">부족</StatusBadge>}
      {state === "none" && <StatusBadge variant="error">없음</StatusBadge>}
      {state === "enough" && inventoryExpiring(item, expiryDays) && (
        <StatusBadge variant="expiring">
          {inventoryExpiryLabel(item)}
        </StatusBadge>
      )}
    </span>
  );
};
export default InventoryBadges;
