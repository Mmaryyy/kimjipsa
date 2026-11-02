"use client";
import { useState } from "react";
import type { CartItem } from "@/entities/cart-item";
import { useInventory, useInventoryMeta } from "@/entities/inventory-item";
import { ConfirmDialog, ErrorState, ListSkeleton, Sheet } from "@/shared/ui";
import RestockForm, { type RestockResults } from "../restock-page/Form";
interface Props {
  items: CartItem[];
  disabled: boolean;
  onClose: () => void;
  onDone: (results: RestockResults, undoToken?: string) => void;
}
const RestockSheet = ({ items, disabled, onClose, onDone }: Props) => {
  const inventory = useInventory();
  const meta = useInventoryMeta();
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const error = inventory.error ?? meta.error;
  let content;
  if (error && (!inventory.data || !meta.data))
    content = (
      <ErrorState
        message={error.message}
        onRetry={() => {
          void inventory.refetch();
          void meta.refetch();
        }}
      />
    );
  else if (!inventory.data || !meta.data)
    content = <ListSkeleton label="구매한 품목을 불러오고 있어요" />;
  else
    content = (
      <RestockForm
        items={items}
        inventory={inventory.data}
        meta={meta.data}
        disabled={disabled}
        onDone={onDone}
        onClose={onClose}
        onPendingChange={setBusy}
      />
    );
  return (
    <>
      <Sheet
        open
        title="재고 반영"
        description="수량과 보관 장소, 유통기한을 확인해 주세요."
        odId="restock-main"
        showCloseButton
        onOpenChange={(open) => {
          if (!open && !busy) setClosing(true);
        }}
      >
        {disabled && (
          <p role="status">연결이 돌아온 뒤 재고에 반영할 수 있어요.</p>
        )}
        {content}
      </Sheet>
      <ConfirmDialog
        open={closing}
        onOpenChange={setClosing}
        title="반영하지 않고 닫을까요?"
        description="재고는 바뀌지 않고, 담은 항목은 장바구니에 그대로 남아요."
        destructive={false}
        confirmLabel="닫기"
        pending={busy}
        onConfirm={onClose}
      />
    </>
  );
};
export default RestockSheet;
