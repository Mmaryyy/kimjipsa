"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import {
  useCart,
  useCartActions,
  parseCartQuickInput,
  type CartInput,
  type CartItem,
  type CartCommand,
} from "@/entities/cart-item";
import { useInventoryMeta } from "@/entities/inventory-item";
import { useCartAdd, CartDuplicateDialog } from "@/features/cart-add";
import { cn } from "@/shared/lib";
import { cartRoutes } from "@/shared/config";
import {
  Banner,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  GroupLabel,
  Input,
  List,
  ListSkeleton,
  PageHeader,
  Text,
  TextButton,
  Toast,
} from "@/shared/ui";
import CartItemRow from "./Row";
import CornerOrderSheet from "../corner-order-sheet";
import CartItemEditor from "../cart-item-editor";
const CartPage = () => {
  const cart = useCart();
  const meta = useInventoryMeta();
  const action = useCartActions();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [order, setOrder] = useState(false);
  const [editor, setEditor] = useState<CartItem | null>(null);
  const [clear, setClear] = useState<string[] | null>(null);
  const [message, setMessage] = useState("");
  const [removed, setRemoved] = useState<CartItem | null>(null);
  const [dismissedSync, setDismissedSync] = useState(0);
  const toastMessage =
    message || (cart.syncedAt > dismissedSync ? "최신 목록으로 맞췄어요" : "");
  const add = useCartAdd((message) => {
    setName("");
    setMessage(message);
  });
  const items = cart.data?.items.filter((item) => !item.purchased_at) ?? [];
  const checked = items.filter((item) => item.is_checked);
  const pending = cart.offline || !cart.data || !meta.data;
  const write = async (command: CartCommand) => {
    if (pending) return;
    try {
      const deleted =
        command.action === "delete"
          ? items.find((item) => item.id === command.id)
          : null;
      await action.mutateAsync(command);
      if (deleted) {
        setRemoved(deleted);
        setMessage(`${deleted.name} 지웠어요`);
      }
      setClear(null);
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : "변경하지 못했어요.",
      );
    }
  };
  const undoDeletion = async () => {
    if (!removed || pending) return;
    const item = removed;
    setRemoved(null);
    try {
      const result = await action.mutateAsync({
        action: "add",
        item,
        duplicate: "separate",
      });
      if (item.is_checked && result.item)
        await action.mutateAsync({
          action: "check",
          id: result.item.id,
          checked: true,
        });
      setMessage("장바구니에 되돌렸어요");
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : "되돌리지 못했어요.",
      );
    }
  };
  const toastAction =
    removed && message === `${removed.name} 지웠어요` && !cart.offline
      ? {
          label: "되돌리기",
          onClick: () => {
            void undoDeletion();
          },
        }
      : undefined;
  const createInput = (value: string): CartInput => {
    return {
      ...parseCartQuickInput(value, meta.data?.units ?? []),
      category_id:
        meta.data?.categories.find((entry) => entry.name === "기타")?.id ??
        null,
      memo: "",
      link_url: "",
      inventory_item_id: null,
    };
  };
  const renderRow = (item: CartItem) => (
    <CartItemRow
      key={item.id}
      item={item}
      index={items.indexOf(item)}
      unit={
        meta.data?.units.find((entry) => entry.id === item.unit_id)?.name ?? ""
      }
      checkedBy={
        cart.data?.members.find((member) => member.user_id === item.checked_by)
          ?.display_name ?? "탈퇴한 사용자"
      }
      editing={editing}
      disabled={pending || action.pendingIds.includes(item.id)}
      pending={action.pendingIds.includes(item.id)}
      onCheck={() =>
        void write({ action: "check", id: item.id, checked: !item.is_checked })
      }
      onEdit={() => setEditor(item)}
      onDelete={() => void write({ action: "delete", id: item.id })}
    />
  );
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
    content = <ListSkeleton label="장바구니를 불러오고 있어요" />;
  else {
    const frequent = cart.data.frequent;
    const categories = [...meta.data.categories].sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    const otherId =
      categories.find((category) => category.name === "기타")?.id ??
      "unassigned";
    const groups = [
      ...categories,
      ...(otherId === "unassigned" ? [{ id: "unassigned", name: "기타" }] : []),
    ].map((category, index) => {
      const rows = items.filter(
        (item) =>
          !item.is_checked &&
          (categories.some((entry) => entry.id === item.category_id)
            ? item.category_id
            : otherId) === category.id,
      );
      if (!rows.length) return null;
      return (
        <section key={category.id}>
          <GroupLabel as="h2" data-od-id={`corner-${index}`}>
            {category.name}
          </GroupLabel>
          <List>{rows.map(renderRow)}</List>
        </section>
      );
    });
    content = (
      <>
        <form
          data-od-id="cart-add-form"
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim() && !pending && !add.pending)
              void add.onAdd(createInput(name));
          }}
        >
          <Input
            aria-label="항목 추가"
            placeholder="항목 추가 (예: 두부 2모)"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={pending || add.pending}
            className="min-h-[var(--ctl-h)] min-w-0 flex-1 bg-muted py-1"
          />
          <Button
            type="submit"
            size="sm"
            data-od-id="cart-add-submit"
            disabled={pending || add.pending || !name.trim()}
          >
            추가
          </Button>
        </form>
        {add.error && !add.duplicate && (
          <p role="alert" className="mt-2 text-caption text-error-text">
            {add.error}
          </p>
        )}
        <section data-od-id="cart-frequent" className="mt-4">
          <GroupLabel as="h2" className="pt-0">
            자주 사는 품목
          </GroupLabel>
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 pb-2.5">
            {frequent.length ? (
              frequent.map((item, index) => (
                <TextButton
                  key={item.id}
                  size="sm"
                  data-od-id={`freq-${index}`}
                  disabled={pending || add.pending}
                  onClick={() => void add.onAdd({ ...item, quantity: 1 })}
                >
                  <Plus size={14} aria-hidden />
                  {item.name}
                </TextButton>
              ))
            ) : (
              <p className="text-caption text-muted-foreground">
                두 번 이상 구매한 품목이 여기에 보여요.
              </p>
            )}
          </div>
        </section>
        <div data-od-id="cart-list">
          {items.some((item) => !item.is_checked) ? (
            groups
          ) : (
            <EmptyState message="살 것을 모두 담았어요" />
          )}
        </div>
        {checked.length > 0 && (
          <section data-od-id="cart-checked" className="mt-6">
            <div className="flex items-center justify-between">
              <Text as="h2" variant="headline" data-od-id="cart-checked-title">
                담은 항목
              </Text>
              {!cart.offline && (
                <TextButton
                  tone="danger"
                  data-od-id="cart-clear-checked"
                  disabled={pending}
                  onClick={() => setClear(checked.map((item) => item.id))}
                >
                  일괄 삭제
                </TextButton>
              )}
            </div>
            <List>{checked.map(renderRow)}</List>
          </section>
        )}
        <div
          data-od-id="cart-buy-bar"
          className={cn(
            "sticky bottom-[calc(var(--bottom-navigation-offset)+env(safe-area-inset-bottom))]",
            "z-10 mt-4 flex items-center gap-3 bg-background py-2.5 lg:bottom-0",
          )}
        >
          <span className="text-body-sm text-muted-foreground">
            {items.length}개 중 {checked.length}개 담음
          </span>
          <Button
            data-od-id="cart-purchase-complete"
            disabled={
              pending || action.pendingIds.some(Boolean) || !checked.length
            }
            asChild={
              !pending && !action.pendingIds.some(Boolean) && checked.length > 0
            }
          >
            {!pending &&
            !action.pendingIds.some(Boolean) &&
            checked.length > 0 ? (
              <Link href={cartRoutes.restock}>구매 완료</Link>
            ) : (
              "구매 완료"
            )}
          </Button>
        </div>
      </>
    );
  }
  return (
    <div data-od-id="cart-main" className="mx-auto lg:max-w-130">
      <PageHeader
        title="장바구니"
        odId="cart"
        navigation={
          <div className="flex items-center justify-between">
            <TextButton
              size="sm"
              data-od-id="cart-reorder"
              disabled={pending}
              onClick={() => setOrder(true)}
            >
              코너 순서
            </TextButton>
            <TextButton
              data-od-id="cart-edit"
              disabled={pending}
              onClick={() => setEditing(!editing)}
            >
              {editing ? "완료" : "편집"}
            </TextButton>
          </div>
        }
      >
        <p className="mt-1 text-body-sm text-muted-foreground">
          {cart.activity ||
            (companions
              ? `${companions}과 함께 보는 중`
              : "함께 쓰는 장바구니")}
        </p>
      </PageHeader>
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
      {order && meta.data && (
        <CornerOrderSheet
          categories={meta.data.categories}
          disabled={cart.offline}
          onClose={() => setOrder(false)}
        />
      )}
      {editor && meta.data && (
        <CartItemEditor
          item={editor}
          meta={meta.data}
          disabled={cart.offline}
          onClose={() => setEditor(null)}
        />
      )}
      <CartDuplicateDialog
        duplicate={add.duplicate}
        pending={add.pending}
        disabled={cart.offline}
        error={add.error}
        onChoose={(input, choice) => void add.onAdd(input, choice)}
        onClose={() => add.setDuplicate(null)}
      />
      <ConfirmDialog
        open={clear !== null}
        onOpenChange={(open) => {
          if (!open) setClear(null);
        }}
        title={`담은 항목 ${clear?.length ?? 0}개를 삭제할까요?`}
        description="재고에는 반영되지 않아요."
        pending={action.isPending || cart.offline}
        onConfirm={() => {
          if (clear) void write({ action: "clear-checked", ids: clear });
        }}
      />
      <Toast
        open={!!toastMessage}
        onOpenChange={(open) => {
          if (!open) {
            setMessage("");
            setRemoved(null);
            setDismissedSync(cart.syncedAt);
          }
        }}
        message={toastMessage}
        action={toastAction}
      />
    </div>
  );
};
export default CartPage;
