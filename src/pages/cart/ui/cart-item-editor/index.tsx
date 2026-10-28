"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import {
  cartInputSchema,
  useCartActions,
  type CartInput,
  type CartItem,
} from "@/entities/cart-item";
import type { InventoryMeta } from "@/entities/inventory-item";
import {
  Button,
  ConfirmDialog,
  FormFieldRow,
  Input,
  Sheet,
  TextButton,
} from "@/shared/ui";
interface Props {
  item: CartItem;
  meta: InventoryMeta;
  disabled: boolean;
  onClose: () => void;
}
const CartItemEditor = ({ item, meta, disabled, onClose }: Props) => {
  const form = useForm<CartInput>({
    resolver: zodResolver(cartInputSchema),
    defaultValues: item,
  });
  const action = useCartActions();
  const [discard, setDiscard] = useState(false);
  const [error, setError] = useState("");
  const save = form.handleSubmit(async (input) => {
    if (disabled) return;
    if (!form.formState.isDirty) {
      onClose();
      return;
    }
    try {
      await action.mutateAsync({ action: "save", id: item.id, item: input });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "저장하지 못했어요.");
    }
  });
  const close = () => {
    if (action.isPending) return;
    if (form.formState.isDirty) setDiscard(true);
    else onClose();
  };
  return (
    <>
      <Sheet
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title="항목 수정"
        description="장바구니 품목을 수정해요."
        leadingAction={() => <TextButton onClick={close}>취소</TextButton>}
        action={
          <TextButton
            disabled={disabled || action.isPending}
            onClick={() => void save()}
          >
            저장
          </TextButton>
        }
      >
        <form onSubmit={save}>
          {(
            [
              ["name", "이름"],
              ["quantity", "수량"],
              ["memo", "메모"],
              ["link_url", "쇼핑몰 링크"],
            ] as const
          ).map(([key, label]) => (
            <FormFieldRow
              key={key}
              label={label}
              htmlFor={`cart-edit-${key}`}
              invalid={!!form.formState.errors[key]}
              error={form.formState.errors[key]?.message}
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
                  disabled={disabled}
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
                  disabled={disabled}
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
          {error && (
            <p role="alert" className="text-error-text">
              {error}
            </p>
          )}
          <Button type="submit" className="sr-only" disabled={disabled}>
            저장
          </Button>
        </form>
      </Sheet>
      <ConfirmDialog
        open={discard}
        onOpenChange={setDiscard}
        targetName={item.name}
        title="변경 사항을 저장할까요?"
        description={error || "저장하지 않으면 바꾼 내용이 사라져요."}
        cancelLabel="계속 편집"
        confirmLabel="저장"
        destructive={false}
        pending={action.isPending || disabled}
        onConfirm={() => void save()}
        secondaryAction={{ label: "저장 안 함", onClick: onClose }}
      />
    </>
  );
};
export default CartItemEditor;
