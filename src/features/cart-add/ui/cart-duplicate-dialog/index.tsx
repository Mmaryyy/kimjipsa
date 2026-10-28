"use client";
import { ConfirmDialog } from "@/shared/ui";
import type { CartInput, CartItem } from "@/entities/cart-item";
interface Props {
  duplicate: { item: CartInput; existing: CartItem } | null;
  pending: boolean;
  disabled?: boolean;
  error: string;
  onChoose: (item: CartInput, choice: "merge" | "separate") => void;
  onClose: () => void;
}
const CartDuplicateDialog = ({
  duplicate,
  pending,
  disabled,
  error,
  onChoose,
  onClose,
}: Props) => {
  if (!duplicate) return null;
  const canMerge = duplicate.item.unit_id === duplicate.existing.unit_id;
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
      targetName={duplicate.existing.name}
      title="항목이 이미 있어요"
      description={
        error ||
        (canMerge
          ? "수량을 더할까요, 따로 추가할까요?"
          : "단위가 달라요. 따로 추가할 수 있어요.")
      }
      destructive={false}
      pending={pending || disabled}
      confirmLabel={canMerge ? "수량 더하기" : "따로 추가"}
      onConfirm={() =>
        onChoose(duplicate.item, canMerge ? "merge" : "separate")
      }
      secondaryAction={
        canMerge
          ? {
              label: "따로 추가",
              onClick: () => onChoose(duplicate.item, "separate"),
            }
          : undefined
      }
    />
  );
};
export default CartDuplicateDialog;
