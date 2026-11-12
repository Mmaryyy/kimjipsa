"use client";
import type { CategoryColor } from "@/shared/lib";

import { useCallback, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  eventCategorySchema,
  useEventCategories,
  eventCategoryColors,
  type EventCategory,
  type EventCategoryInput,
} from "@/entities/event";
import { CategoryDot, FormFieldRow, GroupLabel, Text } from "@/shared/ui";
import EventCategoryColorPicker from "./ColorPicker";
import { useCategoryEditor } from "../../model/use-category-editor";
interface Props {
  category?: EventCategory;
  formId?: string;
  onDirtyChange?: (dirty: boolean) => void;
  onSaved: () => void;
}

const EventCategoryForm = ({
  category,
  onSaved,
  formId,
  onDirtyChange,
}: Props) => {
  const categories = useEventCategories();
  const nextOrder =
    Math.max(
      -1,
      ...(categories.data ?? []).map((category) => category.sortOrder),
    ) + 1;
  const { onSave } = useCategoryEditor(category?.id, onSaved);
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Omit<EventCategoryInput, "sortOrder">>({
    resolver: zodResolver(eventCategorySchema.omit({ sortOrder: true })),
    defaultValues: category ?? {
      name: "",
      color: Object.keys(eventCategoryColors)[0] as EventCategoryInput["color"],
    },
  });
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);
  const onSubmit = useCallback(
    async (input: Omit<EventCategoryInput, "sortOrder">) => {
      try {
        await onSave({ ...input, sortOrder: category?.sortOrder ?? nextOrder });
      } catch (error) {
        setError("root", {
          message:
            error instanceof Error ? error.message : "저장하지 못했어요.",
        });
      }
    },
    [onSave, setError, category, nextOrder],
  );
  const color = useWatch({ control, name: "color" });
  const customSelected = color.startsWith("#");
  const colorLabel = customSelected
    ? "직접 선택"
    : eventCategoryColors[color as keyof typeof eventCategoryColors];
  const onCustomColor = useCallback(
    (color: CategoryColor) => {
      setValue("color", color, { shouldDirty: true, shouldValidate: true });
    },
    [setValue],
  );
  const busy = isSubmitting;
  return (
    <form
      id={formId}
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
                autoComplete="off"
                autoFocus
              />
            </div>
          )}
        </FormFieldRow>
        <fieldset data-od-id="lists-colors" className="min-w-0">
          <legend>
            <GroupLabel as="span">색상 · {colorLabel}</GroupLabel>
          </legend>
          <EventCategoryColorPicker color={color} onChange={onCustomColor} />
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
    </form>
  );
};

export default EventCategoryForm;
