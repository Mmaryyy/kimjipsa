"use client";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  eventCategorySchema,
  useEventCategories,
  eventCategoryColors,
  type EventCategory,
  type EventCategoryInput,
} from "@/entities/event";
import { Button, FormFieldRow, Text } from "@/shared/ui";
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
  const { onSave } = useCategoryEditor(category?.id, onSaved);
  const {
    register,
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
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3" noValidate>
      <fieldset disabled={isSubmitting} className="grid min-w-0 gap-2">
        <legend className="sr-only">일정 카테고리 입력</legend>
        <FormFieldRow
          label="이름"
          htmlFor="category-name"
          invalid={!!errors.name}
          error={errors.name?.message}
        >
          {(props) => (
            <input
              {...props}
              {...register("name")}
              readOnly={category?.name === "기타"}
              autoFocus
            />
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
        <FormFieldRow
          label="색"
          htmlFor="category-color"
          invalid={!!errors.color}
          error={errors.color?.message}
        >
          {(props) => (
            <select {...props} {...register("color")}>
              {Object.entries(eventCategoryColors).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </FormFieldRow>
      </fieldset>
      {errors.root && (
        <Text as="p" role="alert" className="text-error-text">
          {errors.root.message}
        </Text>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "저장하고 있어요" : "저장하기"}
      </Button>
    </form>
  );
}
