"use client";
import Link from "next/link";
import { useCart } from "@/entities/cart-item";
import { useInventoryMeta } from "@/entities/inventory-item";
import { RestockSheet } from "@/features/cart-checkout";
import { cn } from "@/shared/lib";
import { inventoryListPath } from "@/shared/config";
import {
  Banner,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  PageHeader,
  PageLayout,
  Toast,
} from "@/shared/ui";
import { useCartPageActions } from "../../model/use-cart-page-actions";
import { useCartQuickAdd } from "../../model/use-cart-quick-add";
import CartItemEditor from "../cart-item-editor";
import CartQuickAddForm from "./QuickAddForm";
import CartFrequentItems from "./FrequentItems";
import CartCheckedActions from "./CheckedActions";
import CartCategoryGroup from "./CategoryGroup";
import CartSkeleton from "./CartSkeleton";

const CartPage = () => {
  const cart = useCart();
  const meta = useInventoryMeta();
  const actions = useCartPageActions(cart, Boolean(meta.data));
  const quickAdd = useCartQuickAdd(meta, actions.pending, actions.onMessage);
  const companions = cart.data?.members
    .filter((member) => member.user_id !== cart.data?.actorId)
    .map((member) => `${member.display_name}님`)
    .join(", ");
  let content;
  if ((cart.isError && !cart.data) || (meta.isError && !meta.data))
    content = (
      <ErrorState
        message={(cart.error ?? meta.error)?.message}
        onRetry={() => {
          void cart.refetch();
          void meta.refetch();
        }}
      />
    );
  else if (!cart.data || !meta.data)
    content = <CartSkeleton frequent={Boolean(cart.data?.frequent.length)} />;
  else {
    const { frequent, members } = cart.data;
    const { units } = meta.data;
    const categories = [...meta.data.categories].sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    const otherId =
      categories.find((category) => category.name === "기타")?.id ??
      "unassigned";
    const groups = [
      ...categories,
      ...(otherId === "unassigned" ? [{ id: "unassigned", name: "기타" }] : []),
    ];
    content = (
      <>
        <CartQuickAddForm
          quickAdd={quickAdd}
          pending={actions.pending}
          offline={cart.offline}
        />
        <CartCheckedActions
          count={actions.checked.length}
          busy={actions.busy}
          onPurchase={() => void actions.onProcessItems(actions.checked)}
          onDelete={actions.onClear}
        />
        <div data-od-id="cart-list">
          {actions.items.length ? (
            groups.map((category, index) => (
              <CartCategoryGroup
                key={category.id}
                category={category}
                index={index}
                categories={categories}
                otherId={otherId}
                units={units}
                members={members}
                items={actions.items}
                pending={actions.pending}
                busy={actions.busy}
                pendingIds={actions.pendingIds}
                openedRow={actions.openedRow}
                onOpenedRowChange={actions.onOpenedRowChange}
                onProcessItems={actions.onProcessItems}
                onWrite={actions.onWrite}
                onEdit={actions.onEdit}
              />
            ))
          ) : (
            <EmptyState message="장바구니가 비었어요" />
          )}
        </div>
        <CartFrequentItems
          frequent={frequent}
          disabled={actions.pending || quickAdd.add.pending}
          onAdd={quickAdd.add.onAdd}
        />
      </>
    );
  }
  return (
    <PageLayout
      width="narrow"
      odId="cart-main"
      className={cn([
        "flex min-h-[calc(100dvh-var(--bottom-navigation-offset)-env(safe-area-inset-bottom))] flex-col",
        "lg:min-h-[calc(100dvh-var(--sp-10))]",
        "pb-4 lg:pb-0",
      ])}
      header={
        <PageHeader
          title="장바구니"
          odId="cart"
          subtitle={
            cart.activity ||
            (companions ? `${companions}과 함께 보는 중` : "함께 쓰는 장바구니")
          }
          actions={
            <>
              <Button variant="glass" asChild>
                <Link
                  href={inventoryListPath("categories", "cart")}
                  aria-label="장바구니 카테고리 설정"
                >
                  설정
                </Link>
              </Button>
            </>
          }
        />
      }
    >
      {cart.offline && (
        <Banner
          variant="warning"
          title="연결이 끊겼어요."
          data-od-id="cart-offline-banner"
        >
          마지막으로 받은 목록을 보여 드려요. 연결되면 바로 최신 목록으로
          맞출게요.
        </Banner>
      )}
      {cart.isError && cart.data && !cart.offline && (
        <ErrorState
          message={cart.error.message}
          onRetry={() => void cart.refetch()}
        />
      )}
      {content}
      {actions.checkout && (
        <RestockSheet
          items={actions.checkout}
          disabled={cart.offline || actions.batchPending}
          onClose={() => void actions.onCloseCheckout()}
          onDone={actions.onCheckoutDone}
        />
      )}
      {actions.editor && meta.data && (
        <CartItemEditor
          item={actions.editor}
          meta={meta.data}
          disabled={cart.offline}
          onClose={() => actions.onEdit(null)}
        />
      )}
      <ConfirmDialog
        open={actions.clear !== null}
        onOpenChange={actions.onClearOpenChange}
        title={`체크한 항목 ${actions.clear?.ids.length ?? 0}개를 삭제할까요?`}
        description="재고에는 반영되지 않아요."
        pending={actions.busy}
        onConfirm={actions.onConfirmClear}
      />
      <Toast
        open={!!actions.toastMessage}
        onOpenChange={actions.onToastOpenChange}
        message={actions.toastMessage}
        action={actions.toastAction}
      />
    </PageLayout>
  );
};
export default CartPage;
