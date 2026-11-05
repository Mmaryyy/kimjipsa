"use client";
import Link from "next/link";
import { useCart } from "@/entities/cart-item";
import { useInventoryMeta } from "@/entities/inventory-item";
import { cartRoutes } from "@/shared/config";
import {
  EmptyState,
  ErrorState,
  List,
  ListRow,
  Skeleton,
  SectionHeader,
  Text,
} from "@/shared/ui";
import { cartSummary } from "./cart-summary.utils";

interface Props {
  instant: Date;
}

const CartSummary = ({ instant }: Props) => {
  const cart = useCart();
  const meta = useInventoryMeta();
  let content;
  if ((cart.isError && !cart.data) || (meta.isError && !meta.data)) {
    content = (
      <ErrorState
        message={(cart.error ?? meta.error)?.message}
        onRetry={() => {
          void cart.refetch();
          void meta.refetch();
        }}
      />
    );
  } else if (!cart.data || !meta.data) {
    content = (
      <div
        role="status"
        aria-label="장바구니를 불러오고 있어요"
        aria-busy="true"
      >
        <List aria-hidden="true">
          <ListRow>
            <div className="flex h-[var(--type-body-lh)] items-center">
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex h-[var(--type-caption-lh)] items-center">
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
          </ListRow>
          {[0, 1, 2].map((index) => (
            <ListRow
              key={index}
              leading={<Skeleton className="h-3 w-18 shrink-0" />}
            >
              <Skeleton className="h-4 w-40 max-w-full" />
            </ListRow>
          ))}
        </List>
      </div>
    );
  } else {
    const summary = cartSummary(cart.data, meta.data, instant);
    content =
      summary.total === 0 ? (
        <EmptyState message="장바구니가 비어 있어요" />
      ) : (
        <>
          <List>
            <ListRow data-od-id="cart-progress" description={summary.activity}>
              {summary.total}개 중 <b>{summary.checked}개</b> 담음
            </ListRow>
            {summary.groups.map((group, index) => (
              <ListRow
                key={group.id}
                data-od-id={`cart-next-${index + 1}`}
                leading={
                  <Text
                    variant="caption"
                    className="w-18 shrink-0 text-muted-foreground"
                  >
                    {group.name}
                  </Text>
                }
              >
                <span className="block truncate">{group.text}</span>
              </ListRow>
            ))}
          </List>
          {summary.remaining > 0 && (
            <Text as="p" variant="caption" className="text-muted-foreground">
              외 {summary.remaining}개 코너
            </Text>
          )}
        </>
      );
  }
  return (
    <section
      className="min-w-0"
      data-od-id="cart-summary"
      aria-labelledby="cart-title"
    >
      <SectionHeader
        id="cart-title"
        data-od-id="cart-title"
        title="장바구니"
        action={
          <Link
            href={cartRoutes.cart}
            data-od-id="cart-more"
            className="text-body-sm text-primary"
          >
            열기
          </Link>
        }
      />
      {cart.offline && (
        <Text as="p" variant="caption" className="text-muted-foreground">
          오프라인이에요. 마지막 장바구니 목록을 보여 드려요.
        </Text>
      )}
      {content}
    </section>
  );
};

export default CartSummary;
