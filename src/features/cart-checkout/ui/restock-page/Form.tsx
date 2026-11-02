"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  useCartActions,
  type CartItem,
  type CartWriteResult,
  type RestockEntry,
} from "@/entities/cart-item";
import type { InventoryItem, InventoryMeta } from "@/entities/inventory-item";
import { compareItemNames, normalizeItemName } from "@/shared/lib";
import { cartRoutes } from "@/shared/config";
import { Button, ConfirmDialog } from "@/shared/ui";
import RestockItem, { type RestockFormValues } from "./Item";
export type RestockResults = (NonNullable<
  CartWriteResult["results"]
>[number] & { existing: boolean; locationName: string })[];
interface Props {
  items: CartItem[];
  inventory: InventoryItem[];
  meta: InventoryMeta;
  disabled: boolean;
  onDone: (results: RestockResults, undoToken?: string) => void;
  onClose?: () => void;
  onPendingChange?: (pending: boolean) => void;
}
const RestockForm = ({
  items,
  inventory,
  meta,
  disabled,
  onDone,
  onClose,
  onPendingChange,
}: Props) => {
  // Freeze the reviewed selection. Concurrent unchecks/purchases are rejected by the RPC.
  const [snapshot] = useState(() =>
    items.map((item) => ({
      item,
      existing: [...inventory]
        .sort((a, b) => a.id.localeCompare(b.id))
        .find((stock) =>
          item.inventory_item_id
            ? stock.id === item.inventory_item_id
            : compareItemNames(stock.name, item.name) === "same",
        ),
    })),
  );
  const leaders = snapshot.map(({ item, existing }, index) =>
    existing
      ? index
      : snapshot.findIndex(
          (candidate) =>
            !candidate.existing &&
            normalizeItemName(candidate.item.name) ===
              normalizeItemName(item.name),
        ),
  );
  const form = useForm<RestockFormValues>({
    defaultValues: {
      entries: snapshot.map(({ item, existing }): RestockEntry => ({
        id: item.id,
        quantity: item.quantity,
        unit_id: existing?.unit_id ?? item.unit_id ?? meta.units[0]?.id ?? "",
        category_id: existing?.category_id ?? item.category_id ?? "",
        location_id: existing?.location_id ?? "",
        expires_on: null,
      })),
    },
  });
  const action = useCartActions();
  const router = useRouter();
  useEffect(() => {
    onPendingChange?.(action.isPending);
  }, [action.isPending, onPendingChange]);
  const [error, setError] = useState("");
  const [skip, setSkip] = useState(false);
  const submit = form.handleSubmit(async (values) => {
    const entries = values.entries.map((entry, index) => {
      const leader = values.entries[leaders[index]!]!;
      return {
        ...entry,
        unit_id: leader.unit_id,
        category_id: leader.category_id,
        location_id:
          leaders[index] === index ? entry.location_id : leader.location_id,
        // The RPC replaces expiry, so a blank existing item must send its saved date.
        expires_on:
          (leaders[index] === index ? entry.expires_on : leader.expires_on) ||
          snapshot[index]?.existing?.expires_on ||
          null,
      };
    });
    if (disabled || action.isPending) return;
    let invalid = false;
    entries.forEach((entry, index) => {
      for (const field of ["unit_id", "category_id", "location_id"] as const)
        if (!entry[field]) {
          form.setError(`entries.${index}.${field}`, {
            message: "선택해 주세요.",
          });
          invalid = true;
        }
      if (!Number.isFinite(entry.quantity) || entry.quantity <= 0) {
        form.setError(`entries.${index}.quantity`, {
          message: "수량을 확인해 주세요.",
        });
        invalid = true;
      }
    });
    if (invalid) return;
    setError("");
    try {
      const result = await action.mutateAsync({ action: "restock", entries });
      onDone(
        (result.results ?? []).map((result, index) => ({
          ...result,
          existing: !!snapshot[index]?.existing || leaders[index] !== index,
          locationName:
            meta.locations.find(
              (location) => location.id === entries[index]?.location_id,
            )?.name ?? "보관 장소 없음",
        })),
        result.undoToken,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "반영하지 못했어요.");
    }
  });
  return (
    <>
      <form data-od-id="restock-form" onSubmit={submit}>
        {snapshot.map(({ item, existing }, index) => (
          <RestockItem
            key={item.id}
            item={item}
            existing={existing}
            leaderIndex={leaders[index] !== index ? leaders[index] : undefined}
            index={index}
            meta={meta}
            form={form}
            disabled={disabled || action.isPending}
          />
        ))}
        {error && (
          <p role="alert" className="mt-3 text-error-text">
            {error}
          </p>
        )}
        <div className="mt-6 grid gap-2">
          <Button
            type="submit"
            data-od-id="restock-apply"
            disabled={disabled || action.isPending}
          >
            {action.isPending ? "반영하고 있어요" : "재고에 반영"}
          </Button>
          <Button
            variant="gray"
            data-od-id="restock-skip"
            disabled={action.isPending}
            onClick={() => setSkip(true)}
          >
            반영 없이 닫기
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={skip}
        onOpenChange={setSkip}
        title="반영하지 않고 닫을까요?"
        description="재고는 바뀌지 않고, 담은 항목은 장바구니에 그대로 남아요."
        destructive={false}
        confirmLabel="닫기"
        onConfirm={() => (onClose ? onClose() : router.push(cartRoutes.cart))}
      />
    </>
  );
};
export default RestockForm;
