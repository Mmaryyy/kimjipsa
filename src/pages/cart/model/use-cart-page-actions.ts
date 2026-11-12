import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
import { useConfirm, useConfirmDisabled } from "@/shared/ui";
import type { RestockSheet } from "@/features/cart-checkout";
import {
  useCartActions,
  type CartItem,
  type CartCommand,
  type useCart,
} from "@/entities/cart-item";

export function useCartPageActions(
  cart: ReturnType<typeof useCart>,
  metaReady: boolean,
) {
  const action = useCartActions();
  const [message, setMessage] = useState("");
  const [openedRow, setOpenedRow] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<CartItem[] | null>(null);
  const [batchPending, setBatchPending] = useState(false);
  const [editor, setEditor] = useState<CartItem | null>(null);
  const confirm = useConfirm();
  const [checkoutChecks, setCheckoutChecks] = useState<string[]>([]);
  const [restockUndo, setRestockUndo] = useState<{
    token: string;
    message: string;
  } | null>(null);
  const [removed, setRemoved] = useState<CartItem | null>(null);
  const [dismissedSync, setDismissedSync] = useState(0);
  const toastMessage =
    message || (cart.syncedAt > dismissedSync ? "최신 목록으로 맞췄어요" : "");
  const items = useMemo(
    () => cart.data?.items.filter((item) => !item.purchased_at) ?? [],
    [cart.data?.items],
  );
  const checked = items.filter((item) => item.is_checked);
  const pending = cart.offline || !cart.data || !metaReady || batchPending;
  const busy = pending || action.isPending || action.pendingIds.length > 0;
  const confirmDisabled = useConfirmDisabled(busy);
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
  const onProcessItems = useCallback(
    async (targets: CartItem[]) => {
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
        setCheckoutChecks(
          targets.filter((item) => !item.is_checked).map((item) => item.id),
        );
        setCheckout(targets.map((item) => ({ ...item, is_checked: true })));
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : "다시 시도해 주세요.";
        setMessage(`일부 항목만 처리됐을 수 있어요. ${reason}`);
      } finally {
        setBatchPending(false);
      }
    },
    [busy, action, setMessage],
  );
  const onWrite = useCallback(
    async (command: CartCommand) => {
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
      } catch (reason) {
        setMessage(
          reason instanceof Error ? reason.message : "변경하지 못했어요.",
        );
      }
    },
    [pending, items, action, setMessage],
  );
  const onCloseCheckout = useCallback(async () => {
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
  }, [busy, checkoutChecks, action, setMessage]);
  const undoDeletion = useCallback(async () => {
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
  }, [removed, pending, action, setMessage]);
  const undoRestock = useCallback(async () => {
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
  }, [restockUndo, busy, action, setMessage]);
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

  const onCheckoutDone = useCallback<
    ComponentProps<typeof RestockSheet>["onDone"]
  >((results, undoToken) => {
    const message = `${results.length}개 품목을 재고에 반영했어요`;
    setCheckout(null);
    setCheckoutChecks([]);
    setRestockUndo(undoToken ? { token: undoToken, message } : null);
    setMessage(message);
  }, []);
  const onToastOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setMessage("");
        setRemoved(null);
        setRestockUndo(null);
        setDismissedSync(cart.syncedAt);
      }
    },
    [cart.syncedAt],
  );
  const onClear = useCallback(() => {
    if (busy) return;
    void confirm({
      disabled: confirmDisabled,
      title: `체크한 항목 ${checked.length}개를 삭제할까요?`,
      description: "재고에는 반영되지 않아요.",
      onConfirm: () =>
        action.mutateAsync({
          action: "clear-checked",
          ids: checked.map((item) => item.id),
        }),
    });
  }, [busy, checked, confirm, action, confirmDisabled]);
  return {
    items,
    checked,
    pending,
    busy,
    batchPending,
    pendingIds: action.pendingIds,
    openedRow,
    onOpenedRowChange: setOpenedRow,
    editor,
    onEdit: setEditor,
    checkout,
    onProcessItems,
    onWrite,
    onCloseCheckout,
    onCheckoutDone,
    onClear,
    toastMessage,
    toastAction,
    onToastOpenChange,
    onMessage: setMessage,
  };
}
