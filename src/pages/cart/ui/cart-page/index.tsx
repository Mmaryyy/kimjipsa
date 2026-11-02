"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Plus, Trash2 } from "lucide-react";
import {
  cartInputSchema,
  useCart,
  useCartActions,
  parseCartQuickInput,
  type CartInput,
  type CartItem,
  type CartCommand,
} from "@/entities/cart-item";
import {
  useInventoryMeta,
  useInventoryActions,
} from "@/entities/inventory-item";
import { useCartAdd, CartDuplicateDialog } from "@/features/cart-add";
import { cn } from "@/shared/lib";
import { inventoryListPath } from "@/shared/config";
import {
  Banner,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  GroupLabel,
  Input,
  List,
  Skeleton,
  SkeletonSection,
  PageHeader,
  Text,
  TextButton,
  Toast,
} from "@/shared/ui";
import CartItemRow from "./Row";
import { RestockSheet } from "@/features/cart-checkout";
import CartItemEditor from "../cart-item-editor";
const CartSkeleton = ({ frequent }: { frequent: boolean }) => (
  <SkeletonSection label="장바구니를 불러오고 있어요">
    <div aria-hidden="true">
      <div className="mt-2 flex gap-2">
        <Skeleton className="h-[var(--ctl-h)] min-w-0 flex-1" />
        <Button size="sm" disabled>
          추가
        </Button>
      </div>
      {frequent && (
        <section className="mt-4">
          <GroupLabel className="pt-0">자주 사는 품목</GroupLabel>
          <div className="flex gap-4 pt-1 pb-2.5">
            <Skeleton className="h-[var(--ctl-h-sm)] w-20" />
            <Skeleton className="h-[var(--ctl-h-sm)] w-20" />
          </div>
        </section>
      )}
      <GroupLabel className="flex h-[calc(var(--sp-5)+var(--sp-half)+var(--type-caption-lh))] items-center">
        <Skeleton className="h-3 w-16" />
      </GroupLabel>
      <List>
        {Array.from({ length: 3 }, (_, index) => (
          <li key={index} className="flex min-h-11 items-start gap-3 py-2">
            <Skeleton className="mt-1 size-5 flex-none rounded-full" />
            <div className="flex h-[var(--type-label-lh)] items-center">
              <Skeleton className="h-4 w-32" />
            </div>
          </li>
        ))}
      </List>
      <div className="mt-4 py-2.5">
        <Skeleton className="h-[var(--type-body-sm-lh)] w-24" />
        <Button disabled>구매 완료</Button>
      </div>
    </div>
  </SkeletonSection>
);
const CartPage = () => {
  const cart = useCart();
  const meta = useInventoryMeta();
  const action = useCartActions();
  const inventoryActions = useInventoryActions();
  const [unknownUnit, setUnknownUnit] = useState<{
    item: CartInput;
    name: string;
  } | null>(null);
  const [unitError, setUnitError] = useState("");
  const [resolvingUnit, setResolvingUnit] = useState(false);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [openedRow, setOpenedRow] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [checkout, setCheckout] = useState<CartItem[] | null>(null);
  const [batchPending, setBatchPending] = useState(false);
  const [editor, setEditor] = useState<CartItem | null>(null);
  const [clear, setClear] = useState<{
    action: "clear-checked" | "delete-selected";
    ids: string[];
  } | null>(null);
  const [checkoutChecks, setCheckoutChecks] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [restockUndo, setRestockUndo] = useState<{
    token: string;
    message: string;
  } | null>(null);
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
  const pending = cart.offline || !cart.data || !meta.data || batchPending;
  const selected = items.filter((item) => selection.includes(item.id));
  const busy = pending || action.isPending || action.pendingIds.length > 0;
  useEffect(() => {
    if (!openedRow) return;
    const close = () => setOpenedRow(null);
    const outside = (event: PointerEvent) => {
      if (
        !(event.target instanceof Element) ||
        event.target
          .closest("[data-cart-row]")
          ?.getAttribute("data-cart-row") !== openedRow
      )
        close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("scroll", close, true);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("scroll", close, true);
      document.removeEventListener("keydown", escape);
    };
  }, [openedRow]);
  const finishEditing = () => {
    setEditing(false);
    setSelection([]);
  };
  const processItems = async (
    targets: CartItem[],
    operation: "check" | "purchase",
  ) => {
    if (busy || !targets.length) return;
    setOpenedRow(null);
    setBatchPending(true);
    try {
      for (const item of targets) {
        if (!item.is_checked)
          await action.mutateAsync({
            action: "check",
            id: item.id,
            checked: true,
          });
      }
      if (operation === "purchase") {
        setCheckoutChecks(
          targets.filter((item) => !item.is_checked).map((item) => item.id),
        );
        setCheckout(targets.map((item) => ({ ...item, is_checked: true })));
      }
      setClear(null);
      finishEditing();
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "다시 시도해 주세요.";
      setMessage(`일부 항목만 처리됐을 수 있어요. ${reason}`);
    } finally {
      setBatchPending(false);
    }
  };
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
      if (command.action === "delete-selected") finishEditing();
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : "변경하지 못했어요.",
      );
    }
  };
  const deleteItems = (targets: CartItem[]) => {
    if (targets.length > 1)
      setClear({
        action: "delete-selected",
        ids: targets.map((item) => item.id),
      });
    else if (targets[0]) void write({ action: "delete", id: targets[0].id });
  };
  const closeCheckout = async () => {
    if (busy) return;
    setBatchPending(true);
    try {
      for (const id of checkoutChecks) {
        await action.mutateAsync({ action: "check", id, checked: false });
        setCheckoutChecks((ids) => ids.filter((entry) => entry !== id));
      }
      setCheckout(null);
    } catch (reason) {
      setMessage(
        reason instanceof Error
          ? reason.message
          : "담음 상태를 되돌리지 못했어요.",
      );
    } finally {
      setBatchPending(false);
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
  const undoRestock = async () => {
    if (!restockUndo || busy) return;
    const token = restockUndo.token;
    setRestockUndo(null);
    try {
      await action.mutateAsync({ action: "undo-restock", token });
      setMessage("재고 반영을 되돌렸어요");
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : "되돌리지 못했어요.",
      );
    }
  };
  const deletionAction =
    removed && message === `${removed.name} 지웠어요` && !cart.offline
      ? {
          label: "되돌리기",
          onClick: () => {
            void undoDeletion();
          },
        }
      : undefined;
  const toastAction =
    restockUndo && message === restockUndo.message && !cart.offline
      ? { label: "되돌리기", onClick: () => void undoRestock() }
      : deletionAction;
  const quickAdd = () => {
    const { unknownUnit: unitName, ...parsed } = parseCartQuickInput(
      name,
      meta.data?.units ?? [],
    );
    const item: CartInput = {
      ...parsed,
      category_id:
        meta.data?.categories.find((entry) => entry.name === "기타")?.id ??
        null,
      memo: "",
      link_url: "",
      inventory_item_id: null,
    };
    const validation = cartInputSchema.safeParse(item);
    if (!validation.success) {
      setMessage(
        validation.error.issues[0]?.message ?? "입력 내용을 확인해 주세요.",
      );
      return;
    }
    const disabledUnit = meta.data?.units.find(
      (unit) => unit.id === item.unit_id && !unit.enabled,
    );
    if (unitName || disabledUnit) {
      setUnitError("");
      setUnknownUnit({ item, name: unitName ?? disabledUnit!.name });
    } else void add.onAdd(item);
  };
  const resolveUnit = async (create: boolean) => {
    if (!unknownUnit || pending || resolvingUnit) return;
    setResolvingUnit(true);
    setUnitError("");
    try {
      let unitId = unknownUnit.item.unit_id;
      if (create) {
        const current = await meta.refetch();
        if (!current.data || current.isError)
          throw new Error("단위를 불러오지 못했어요. 다시 시도해 주세요.");
        let unit = current.data.units.find(
          (entry) =>
            entry.name.toLowerCase() === unknownUnit.name.toLowerCase(),
        );
        if (!unit) {
          await inventoryActions.meta.mutateAsync({
            action: "save",
            kind: "units",
            entry: {
              name: unknownUnit.name,
              enabled: true,
              sort_order: current.data.units.length,
              icon_kind: null,
              icon_value: "",
            },
          });
          const refreshed = await meta.refetch();
          unit = refreshed.data?.units.find(
            (entry) =>
              entry.name.toLowerCase() === unknownUnit.name.toLowerCase(),
          );
          if (refreshed.isError || !unit)
            throw new Error("단위를 확인하지 못했어요. 다시 시도해 주세요.");
        }
        if (!unit.enabled) {
          await inventoryActions.meta.mutateAsync({
            action: "save",
            kind: "units",
            id: unit.id,
            entry: { ...unit, enabled: true },
          });
        }
        unitId = unit.id;
      }
      setUnknownUnit(null);
      await add.onAdd({ ...unknownUnit.item, unit_id: unitId });
    } catch (error) {
      setUnitError(
        error instanceof Error ? error.message : "단위를 추가하지 못했어요.",
      );
    } finally {
      setResolvingUnit(false);
    }
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
      selected={selection.includes(item.id)}
      open={openedRow === item.id && !pending}
      onOpenChange={(open) => setOpenedRow(open ? item.id : null)}
      onSelect={() =>
        setSelection((ids) =>
          ids.includes(item.id)
            ? ids.filter((id) => id !== item.id)
            : [...ids, item.id],
        )
      }
      onPurchase={() => void processItems([item], "purchase")}
      onQuantityChange={(quantity) => {
        if (quantity !== item.quantity)
          void write({
            action: "save",
            id: item.id,
            item: { ...item, quantity },
          });
      }}
      disabled={busy}
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
    content = <CartSkeleton frequent={Boolean(cart.data?.frequent.length)} />;
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
            if (name.trim() && !pending && !add.pending) quickAdd();
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
        {frequent.length > 0 && (
          <section data-od-id="cart-frequent" className="mt-4">
            <GroupLabel as="h2" className="pt-0">
              자주 사는 품목
            </GroupLabel>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 pb-2.5">
              {frequent.map((item, index) => (
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
              ))}
            </div>
          </section>
        )}
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
                  onClick={() =>
                    setClear({
                      action: "clear-checked",
                      ids: checked.map((item) => item.id),
                    })
                  }
                >
                  일괄 삭제
                </TextButton>
              )}
            </div>
            <List>{checked.map(renderRow)}</List>
          </section>
        )}
        {checked.length > 0 && !editing && (
          <div className="mt-4 py-2.5" data-od-id="cart-buy-bar">
            <Button
              size="block"
              aria-label={`장바구니 구매 완료, ${checked.length}개`}
              data-od-id="cart-purchase-complete"
              disabled={busy}
              onClick={() => void processItems(checked, "purchase")}
            >
              장바구니 구매 완료
              <span
                aria-hidden="true"
                className={cn([
                  "ml-1 inline-flex h-6 min-w-6 items-center justify-center",
                  "rounded-full bg-primary-foreground px-1",
                  "text-caption font-semibold text-primary tabular-nums",
                ])}
              >
                {checked.length}
              </span>
            </Button>
          </div>
        )}
      </>
    );
  }
  return (
    <div
      data-od-id="cart-main"
      className={cn([
        "mx-auto flex min-h-[calc(100dvh-var(--bottom-navigation-offset)-env(safe-area-inset-bottom))] flex-col",
        "lg:min-h-[calc(100dvh-var(--sp-10))] lg:max-w-130",
        "pb-4 lg:pb-0",
      ])}
    >
      <PageHeader
        title="장바구니"
        odId="cart"
        subtitle={
          cart.activity ||
          (companions ? `${companions}과 함께 보는 중` : "함께 쓰는 장바구니")
        }
        actions={
          <>
            <Button
              variant="glass"
              data-od-id="cart-edit"
              disabled={busy}
              onClick={() => {
                setOpenedRow(null);
                if (editing) finishEditing();
                else setEditing(true);
              }}
            >
              {editing ? "완료" : "편집"}
            </Button>
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
      {editing && (
        <section
          aria-label="선택 항목 처리"
          className="my-3 flex flex-row justify-between items-center gap-2"
        >
          <div className="flex flex-row gap-2 items-center">
            <TextButton
              disabled={busy || !items.length}
              onClick={() =>
                setSelection(
                  selected.length === items.length
                    ? []
                    : items.map((item) => item.id),
                )
              }
            >
              {selected.length === items.length && items.length > 0
                ? "전체 해제"
                : "전체 선택"}
            </TextButton>
            <span className="text-caption text-muted-foreground">
              {selected.length}개
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant="gray"
              aria-label="선택 항목 담기"
              disabled={busy || !selected.length}
              onClick={() => void processItems(selected, "check")}
            >
              <Plus aria-hidden className="text-primary!" />
            </Button>
            <Button
              size="icon-sm"
              variant="primary"
              aria-label="선택 항목 구매 완료"
              disabled={busy || !selected.length}
              onClick={() => void processItems(selected, "purchase")}
            >
              <Check aria-hidden />
            </Button>
            <Button
              size="icon-sm"
              variant="danger"
              aria-label="선택 항목 삭제"
              disabled={busy || !selected.length}
              onClick={() => deleteItems(selected)}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        </section>
      )}
      {content}
      {checkout && (
        <RestockSheet
          items={checkout}
          disabled={cart.offline || batchPending}
          onClose={() => void closeCheckout()}
          onDone={(results, undoToken) => {
            const message = `${results.length}개 품목을 재고에 반영했어요`;
            setCheckout(null);
            setCheckoutChecks([]);
            setRestockUndo(undoToken ? { token: undoToken, message } : null);
            setMessage(message);
          }}
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
      <ConfirmDialog
        open={unknownUnit !== null}
        onOpenChange={(open) => {
          if (!open && !resolvingUnit) setUnknownUnit(null);
        }}
        title={`'${unknownUnit?.name ?? ""}' 단위를 추가할까요?`}
        description="추가하지 않으면 기본 단위 ‘개’로 담아요."
        confirmLabel="단위 추가"
        cancelLabel="취소"
        secondaryAction={{
          label: "개로 담기",
          onClick: () => void resolveUnit(false),
        }}
        destructive={false}
        pending={resolvingUnit || pending}
        onConfirm={() => void resolveUnit(true)}
      >
        {unitError && (
          <p role="alert" className="text-caption text-error-text">
            {unitError}
          </p>
        )}
      </ConfirmDialog>
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
        title={`선택한 항목 ${clear?.ids.length ?? 0}개를 삭제할까요?`}
        description="재고에는 반영되지 않아요."
        pending={busy}
        onConfirm={() => {
          if (clear) void write(clear);
        }}
      />
      <Toast
        open={!!toastMessage}
        onOpenChange={(open) => {
          if (!open) {
            setMessage("");
            setRemoved(null);
            setRestockUndo(null);
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
