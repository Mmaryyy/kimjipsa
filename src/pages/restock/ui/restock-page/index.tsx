"use client";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/entities/cart-item";
import { useInventory, useInventoryMeta } from "@/entities/inventory-item";
import { cartRoutes, inventoryRoutes } from "@/shared/config";
import {
  Banner,
  Button,
  EmptyState,
  ErrorState,
  List,
  PageHeader,
  PageLayout,
} from "@/shared/ui";
import {
  RestockForm,
  RestockSkeleton,
  type RestockResults,
} from "@/features/cart-checkout";
const RestockPage = () => {
  const cart = useCart();
  const inventory = useInventory();
  const meta = useInventoryMeta();
  const [results, setResults] = useState<RestockResults | null>(null);
  const items =
    cart.data?.items.filter((item) => !item.purchased_at && item.is_checked) ??
    [];
  const error = cart.error ?? inventory.error ?? meta.error;
  let content;
  if (results)
    content = (
      <section data-od-id="restock-done">
        <List className="mt-4">
          {results.map((item, index) => (
            <li
              key={index}
              data-od-id={`restock-result-${index}`}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div>
                <span>{item.name}</span>
                <p className="text-caption text-muted-foreground">
                  {item.existing
                    ? "기존 재고에 더함"
                    : `새 품목 · ${item.locationName}`}
                </p>
              </div>
              <span className="font-semibold text-success-text">
                {item.unit_id
                  ? `${item.quantity}${meta.data?.units.find((unit) => unit.id === item.unit_id)?.name ?? ""}`
                  : "충분"}
              </span>
            </li>
          ))}
        </List>
        <div className="mt-6 grid gap-2">
          <Button asChild>
            <Link
              data-od-id="restock-go-inventory"
              href={inventoryRoutes.inventory}
            >
              재고 보기
            </Link>
          </Button>
          <Button variant="gray" asChild>
            <Link data-od-id="restock-go-cart" href={cartRoutes.cart}>
              장바구니로
            </Link>
          </Button>
        </div>
      </section>
    );
  else if (error && (!cart.data || !inventory.data || !meta.data))
    content = (
      <ErrorState
        message={error.message}
        onRetry={() => {
          void cart.refetch();
          void inventory.refetch();
          void meta.refetch();
        }}
      />
    );
  else if (!cart.data || !inventory.data || !meta.data)
    content = <RestockSkeleton />;
  else if (!items.length)
    content = (
      <EmptyState
        message="담은 항목이 없어요"
        action={<Link href={cartRoutes.cart}>장바구니로</Link>}
      />
    );
  else
    content = (
      <RestockForm
        items={items}
        inventory={inventory.data}
        meta={meta.data}
        disabled={cart.offline}
        onDone={(value) => {
          setResults(value);
          window.scrollTo(0, 0);
        }}
      />
    );
  return (
    <PageLayout
      width="narrow"
      odId="restock-main"
      header={
        <PageHeader
          title={results ? "반영했어요" : "재고 반영"}
          odId="restock"
          navigation={
            <Link
              data-od-id="restock-back"
              href={cartRoutes.cart}
              className="inline-flex min-h-11 items-center text-primary"
            >
              ‹ 장바구니
            </Link>
          }
          subtitle={
            results
              ? `구매한 ${results.length}개 품목이 장바구니에서 빠지고 구매 기록에 남았어요.`
              : "구매한 품목을 재고에 반영하기 전에 확인해 주세요."
          }
        />
      }
    >
      {cart.offline && !results && (
        <Banner title="연결이 끊겼어요." variant="warning">
          연결이 돌아온 뒤 재고에 반영할 수 있어요.
        </Banner>
      )}
      {content}
    </PageLayout>
  );
};
export default RestockPage;
