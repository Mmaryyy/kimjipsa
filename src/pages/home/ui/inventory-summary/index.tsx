"use client";
import Link from "next/link";
import {
  useInventory,
  useInventoryMeta,
  inventoryState,
  inventoryExpiring,
  InventoryBadges,
} from "@/entities/inventory-item";
import { inventoryRoutes } from "@/shared/config";
import {
  SectionHeader,
  List,
  ListRow,
  EmptyState,
  ErrorState,
  ListSkeleton,
} from "@/shared/ui";
const InventorySummary = () => {
  const inventory = useInventory();
  const meta = useInventoryMeta();
  let content;
  if (inventory.isError || meta.isError)
    content = (
      <ErrorState
        message={(inventory.error ?? meta.error)?.message}
        onRetry={() => {
          void inventory.refetch();
          void meta.refetch();
        }}
      />
    );
  else if (inventory.isPending || meta.isPending)
    content = <ListSkeleton label="확인할 재고를 불러오고 있어요" rows={3} />;
  else {
    const attention = inventory.data.filter(
      (item) =>
        inventoryState(item) !== "enough" ||
        inventoryExpiring(item, meta.data.expiry_days),
    );
    content =
      attention.length === 0 ? (
        <EmptyState message="확인할 재고가 없어요." />
      ) : (
        <List>
          {attention.map((item, index) => (
            <ListRow
              key={item.id}
              data-od-id={`stock-${index}`}
              trailing={
                <InventoryBadges
                  item={item}
                  expiryDays={meta.data.expiry_days}
                />
              }
            >
              <Link href={inventoryRoutes.inventory} className="grid gap-0.5">
                <span>{item.name}</span>
                <span className="text-caption text-muted-foreground">
                  {[
                    item.mode === "quantity"
                      ? `${item.quantity}${
                          meta.data.units.find(
                            (entry) => entry.id === item.unit_id,
                          )?.name ?? ""
                        } 남음`
                      : null,
                    meta.data.locations.find(
                      (entry) => entry.id === item.location_id,
                    )?.name,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </Link>
            </ListRow>
          ))}
        </List>
      );
  }
  return (
    <section data-od-id="stock-summary" aria-labelledby="stock-title">
      <SectionHeader
        id="stock-title"
        title="확인할 재고"
        action={
          <Link
            href={inventoryRoutes.inventory}
            data-od-id="stock-more"
            className="text-body-sm text-primary"
          >
            전체 보기
          </Link>
        }
      />
      {content}
    </section>
  );
};
export default InventorySummary;
