"use client";
import { useCallback, useState } from "react";
import {
  useCartActions,
  type CartInput,
  type CartItem,
} from "@/entities/cart-item";
import { useInventoryMeta } from "@/entities/inventory-item";
export function useCartAdd(onAdded?: (message: string) => void) {
  const action = useCartActions();
  const meta = useInventoryMeta();
  const [duplicate, setDuplicate] = useState<{
    item: CartInput;
    existing: CartItem;
  } | null>(null);
  const [error, setError] = useState("");
  const onAdd = useCallback(
    async (item: CartInput, choice: "ask" | "merge" | "separate" = "ask") => {
      setError("");
      try {
        const result = await action.mutateAsync({
          action: "add",
          item,
          duplicate: choice,
        });
        if (result.duplicate) {
          setDuplicate({ item, existing: result.duplicate });
          return false;
        }
        const existing = duplicate?.existing;
        const message =
          choice === "merge" && existing
            ? `${existing.name} ${existing.quantity + item.quantity}` +
              `${meta.data?.units.find((unit) => unit.id === existing.unit_id)?.name ?? ""}로 바꿨어요`
            : "장바구니에 담았어요";
        setDuplicate(null);
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
    [action, onAdded, duplicate, meta.data],
  );
  return { onAdd, duplicate, setDuplicate, error, pending: action.isPending };
}
