"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import {
  cartInputSchema,
  useCartActions,
  type CartInput,
} from "@/entities/cart-item";
import type { InventoryMeta } from "@/entities/inventory-item";
import { FormFieldRow, Input, FormSheet, Switch } from "@/shared/ui";
interface Props {
  item: CartInput & { id?: string; hidden?: boolean };
  frequent?: boolean;
  meta: InventoryMeta;
  disabled: boolean;
  onClose: () => void;
}
const CartItemEditor = ({
  item,
  meta,
  disabled,
  onClose,
  frequent = false,
}: Props) => {
  const form = useForm<CartInput>({
    resolver: zodResolver(cartInputSchema),
    defaultValues: item,
  });
  const { isDirty, errors } = form.formState;
  const action = useCartActions();
  const [hidden, setHidden] = useState(item.hidden ?? false);
  const changed = isDirty || hidden !== (item.hidden ?? false);
  const [error, setError] = useState("");
  const save = form.handleSubmit(async (input) => {
    if (disabled) return;
    if (!changed) {
      onClose();
      return;
    }
    try {
      await action.mutateAsync(
        frequent
          ? {
              action: "save-frequent",
              item: isDirty
                ? { ...input, hidden }
                : { name: item.name, hidden },
            }
          : { action: "save", id: item.id!, item: input },
      );
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "저장하지 못했어요.");
    }
  });

  return (
    <FormSheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={frequent ? item.name : "항목 수정"}
      description={
        frequent
          ? "칩으로 담으면 수량 1로 추가해요."
          : "장바구니 품목을 수정해요."
      }
      dirty={changed}
      pending={action.isPending}
      submitDisabled={disabled}
    >
      {(formId) => (
        <form id={formId} onSubmit={save}>
          {(
            [
              ["name", "이름"],
              ["quantity", "수량"],
              ["memo", "메모"],
              ["link_url", "쇼핑몰 링크"],
            ] as const
          )
            .filter(
              ([key]) => !frequent || (key !== "name" && key !== "quantity"),
            )
            .map(([key, label]) => (
              <FormFieldRow
                key={key}
                label={label}
                htmlFor={`cart-edit-${key}`}
                invalid={!!errors[key]}
                error={errors[key]?.message}
              >
                {(props) => (
                  <Input
                    {...props}
                    {...form.register(
                      key,
                      key === "quantity" ? { valueAsNumber: true } : {},
                    )}
                    type={key === "quantity" ? "number" : "text"}
                    step="any"
                    disabled={disabled || action.isPending}
                  />
                )}
              </FormFieldRow>
            ))}
          {(
            [
              ["unit_id", "단위", meta.units],
              ["category_id", "카테고리", meta.categories],
            ] as const
          ).map(([key, label, entries]) => (
            <FormFieldRow key={key} label={label} htmlFor={`cart-edit-${key}`}>
              {(props) => (
                <select
                  {...props}
                  {...form.register(key, {
                    setValueAs: (value) => value || null,
                  })}
                  disabled={disabled || action.isPending}
                >
                  <option value="">선택 안 함</option>
                  {entries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              )}
            </FormFieldRow>
          ))}
          {frequent && (
            <FormFieldRow
              label="목록에서 숨기기"
              htmlFor="frequent-hidden"
              className="[&>label]:basis-auto"
            >
              {(props) => (
                <Switch
                  {...props}
                  checked={hidden}
                  onCheckedChange={setHidden}
                  disabled={disabled || action.isPending}
                />
              )}
            </FormFieldRow>
          )}
          {error && (
            <p role="alert" className="text-error-text">
              {error}
            </p>
          )}
        </form>
      )}
    </FormSheet>
  );
};
export default CartItemEditor;
