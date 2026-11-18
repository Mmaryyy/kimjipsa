"use client";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import {
  cartInputSchema,
  useCartActions,
  type CartInput,
} from "@/entities/cart-item";
import type { InventoryMeta } from "@/entities/inventory-item";
import { FormField, FormFieldRow, Switch, Input, FormSheet } from "@/shared/ui";
const Field = FormField<CartInput>;
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
  const [hidden, setHidden] = useState(item.hidden ?? false);
  const { isDirty } = form.formState;
  const action = useCartActions();
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
  const pending = disabled || action.isPending;
  return (
    <FormProvider {...form}>
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
            {!frequent && (
              <>
                <Field
                  name="name"
                  label="이름"
                  disabled={pending}
                  render={(field) => <Input {...field} />}
                />
                <Field
                  name="quantity"
                  label="수량"
                  type="number"
                  disabled={pending}
                  inputProps={{ step: "any" }}
                />
              </>
            )}
            <Field
              name="memo"
              label="메모"
              disabled={pending}
              render={(field) => <Input {...field} value={field.value ?? ""} />}
            />
            <Field
              name="link_url"
              label="쇼핑몰 링크"
              disabled={pending}
              render={(field) => <Input {...field} value={field.value ?? ""} />}
            />
            <Field
              name="unit_id"
              label="단위"
              type="select"
              disabled={pending}
              noneLabel="선택 안 함"
              options={meta.units.map((entry) => ({
                value: entry.id,
                label: entry.name,
              }))}
            />
            <Field
              name="category_id"
              label="카테고리"
              type="select"
              disabled={pending}
              noneLabel="선택 안 함"
              options={meta.categories.map((entry) => ({
                value: entry.id,
                label: entry.name,
              }))}
            />
            {frequent && (
              <FormFieldRow
                label="목록에서 숨기기"
                htmlFor="frequent-hidden"
                className="[&>label]:basis-auto"
              >
                {(controlProps) => (
                  <Switch
                    {...controlProps}
                    checked={hidden}
                    onCheckedChange={setHidden}
                    disabled={pending}
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
    </FormProvider>
  );
};
export default CartItemEditor;
