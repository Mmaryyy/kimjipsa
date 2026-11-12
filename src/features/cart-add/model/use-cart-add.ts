"use client";
import { useCallback, useState } from "react";
import { useCartActions, type CartInput } from "@/entities/cart-item";
import { useInventoryMeta } from "@/entities/inventory-item";
import { useConfirm } from "@/shared/ui";

export function useCartAdd(
  onAdded?: (message: string) => void,
  autoCategory = false,
) {
  const action = useCartActions();
  const meta = useInventoryMeta();
  const confirm = useConfirm();
  const [error, setError] = useState("");

  const onAdd = useCallback(
    async (
      item: CartInput,
      choice: "ask" | "merge" | "separate" = "ask",
      recommendCategory = autoCategory,
    ) => {
      setError("");
      try {
        const result = await action.mutateAsync({
          action: "add",
          item,
          duplicate: choice,
          autoCategory: recommendCategory,
        });
        let message = "장바구니에 담았어요";
        if (result.duplicate) {
          const existing = result.duplicate;
          const canMerge = item.unit_id === existing.unit_id;
          let added = false;
          const addDuplicate = async (duplicate: "merge" | "separate") => {
            await action.mutateAsync({
              action: "add",
              item,
              duplicate,
              autoCategory: recommendCategory,
            });
            added = true;
            if (duplicate === "merge") {
              const unit =
                meta.data?.units.find((unit) => unit.id === existing.unit_id)
                  ?.name ?? "";
              message = `${existing.name} ${existing.quantity + item.quantity}${unit}로 바꿨어요`;
            }
          };

          await confirm({
            disabled: () => !navigator.onLine,
            targetName: existing.name,
            title: "항목이 이미 있어요",
            description: canMerge
              ? "수량을 더할까요, 따로 추가할까요?"
              : "단위가 달라요. 따로 추가할 수 있어요.",
            destructive: false,
            confirmLabel: canMerge ? "수량 더하기" : "따로 추가",
            onConfirm: () => addDuplicate(canMerge ? "merge" : "separate"),
            secondaryAction: canMerge
              ? {
                  label: "따로 추가",
                  onClick: () => addDuplicate("separate"),
                }
              : undefined,
          });

          if (!added) return false;
        }
        onAdded?.(message);
        return true;
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "장바구니에 담지 못했어요.",
        );
        return false;
      }
    },
    [action, onAdded, meta.data, autoCategory, confirm],
  );
  return { onAdd, error, pending: action.isPending };
}
