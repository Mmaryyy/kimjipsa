"use client";
import { cn } from "@/shared/lib";

import { useCallback, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  eventCategorySchema,
  useEventCategories,
  eventCategoryColors,
  type EventCategory,
  type EventCategoryInput,
} from "@/entities/event";
import {
  CategoryDot,
  ConfirmDialog,
  FormFieldRow,
  GroupLabel,
  Text,
  TextButton,
} from "@/shared/ui";
import { useCategoryEditor } from "../model/use-category-editor";
export function EventCategoryForm({
  category,
  onSaved,
}: {
  category?: EventCategory;
  onSaved: () => void;
}) {
  const categories = useEventCategories();
  const nextOrder =
    Math.max(
      -1,
      ...(categories.data ?? []).map((category) => category.sortOrder),
    ) + 1;
  const [confirming, setConfirming] = useState(false);
  const { onSave, onDelete, deleting, deleteError } = useCategoryEditor(
    category?.id,
    onSaved,
  );
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EventCategoryInput>({
    resolver: zodResolver(eventCategorySchema),
    defaultValues: category ?? {
      name: "",
      sortOrder: nextOrder,
      color: Object.keys(eventCategoryColors)[0] as EventCategoryInput["color"],
    },
  });
  const onSubmit = useCallback(
    async (input: EventCategoryInput) => {
      try {
        await onSave(input);
      } catch (error) {
        setError("root", {
          message:
            error instanceof Error ? error.message : "저장하지 못했어요.",
        });
      }
    },
    [onSave, setError],
  );
  const color = useWatch({ control, name: "color" });
  const busy = isSubmitting || deleting;
  return (
    <form
      id="category-form"
      onSubmit={(event) => {
        if (busy) {
          event.preventDefault();
          return;
        }
        void handleSubmit(onSubmit)(event);
      }}
      className="grid gap-3"
      noValidate
      aria-busy={busy}
    >
      <fieldset disabled={busy} className="grid min-w-0 gap-2">
        <legend className="sr-only">일정 카테고리 입력</legend>
        <FormFieldRow
          label="이름"
          htmlFor="category-name"
          invalid={!!errors.name}
          error={errors.name?.message}
        >
          {(props) => (
            <div className="flex items-center gap-3">
              <CategoryDot color={color} />
              <input
                {...props}
                {...register("name")}
                data-od-id="lists-name"
                placeholder="이름"
                readOnly={category?.name === "기타"}
                autoFocus
              />
            </div>
          )}
        </FormFieldRow>
        <FormFieldRow
          label="표시 순서 (0부터)"
          htmlFor="category-order"
          invalid={!!errors.sortOrder}
          error={errors.sortOrder?.message}
        >
          {(props) => (
            <input
              {...props}
              {...register("sortOrder", { valueAsNumber: true })}
              type="number"
              min={0}
              step={1}
            />
          )}
        </FormFieldRow>
        <fieldset data-od-id="lists-colors" className="min-w-0">
          <legend>
            <GroupLabel as="span">
              색상 · {eventCategoryColors[color]}
            </GroupLabel>
          </legend>
          <div className="grid max-w-90 grid-cols-[repeat(auto-fill,calc(var(--sp-8)+var(--sp-1)))] gap-2 pt-2 pb-1">
            {Object.entries(eventCategoryColors).map(([value, label]) => (
              <label
                key={value}
                className={cn([
                  "relative grid size-9 place-items-center [&_input]:absolute [&_input]:inset-0",
                  "[&_input]:cursor-pointer [&_input]:opacity-0",
                  "[&_[data-slot=category-dot]]:pointer-events-none [&_[data-slot=category-dot]]:size-6.5",
                  "[&:has(input:checked)_[data-slot=category-dot]]:outline-2",
                  "[&:has(input:checked)_[data-slot=category-dot]]:outline-[var(--category-color)]",
                  "[&:has(input:checked)_[data-slot=category-dot]]:outline-offset-4",
                  "[&:has(input:checked)_[data-slot=category-dot]]:scale-[var(--swatch-selected-scale)]",
                  "has-[:focus-visible]:rounded-[var(--r-round)] has-[:focus-visible]:outline-2",
                  "has-[:focus-visible]:outline-primary has-[:focus-visible]:outline-offset-2",
                ])}
              >
                <input
                  {...register("color")}
                  type="radio"
                  value={value}
                  aria-label={label}
                />
                <CategoryDot color={value as EventCategoryInput["color"]} />
              </label>
            ))}
          </div>
          {errors.color && (
            <Text as="p" role="alert" className="text-error-text">
              {errors.color.message}
            </Text>
          )}
        </fieldset>
      </fieldset>
      {errors.root && (
        <Text as="p" role="alert" className="text-error-text">
          {errors.root.message}
        </Text>
      )}
      {category && category.name !== "기타" && (
        <TextButton
          className="mt-5 justify-self-start"
          data-od-id="lists-delete"
          tone="danger"
          onClick={() => setConfirming(true)}
          disabled={busy}
        >
          삭제
        </TextButton>
      )}
      {deleteError && (
        <Text as="p" role="alert" className="text-error-text">
          {deleteError.message}
        </Text>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!deleting) setConfirming(open);
        }}
        targetName={category?.name ?? ""}
        title="카테고리를 삭제할까요?"
        description={
          deleteError?.message ?? "이 카테고리의 일정은 기타로 옮겨져요."
        }
        onConfirm={onDelete}
        pending={deleting}
      />
    </form>
  );
}
