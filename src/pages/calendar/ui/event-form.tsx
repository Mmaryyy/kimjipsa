"use client";
import { useCallback } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  type CalendarEvent,
  type EventCategory,
  type EventInput,
  eventDateInput,
  eventVisibility,
} from "@/entities/event";
import { Button, FormFieldRow, Switch, Text } from "@/shared/ui";
import {
  eventFormSchema,
  type EventFormInput,
} from "../model/event-form.schema";
import { useEventEditor } from "../model/use-event-editor";
function initialValues(
  event: CalendarEvent | undefined,
  categories: EventCategory[],
): EventFormInput {
  const now = new Date();
  return {
    title: event?.details?.title ?? "",
    place: event?.details?.place ?? "",
    memo: event?.details?.memo ?? "",
    categoryId: event?.details?.categoryId ?? categories[0]?.id ?? "",
    visibility: event?.visibility ?? "shared",
    isAllDay: event?.isAllDay ?? false,
    startDate: event?.startDate ?? eventDateInput(now.toISOString()),
    endDate: event?.endDate ?? eventDateInput(now.toISOString()),
    startTime: event?.startTime ?? "",
    endTime: event?.endTime ?? "",
  };
}
export function EventForm({
  event,
  categories,
  onSaved,
}: {
  event?: CalendarEvent;
  categories: EventCategory[];
  onSaved: () => void;
}) {
  const { onSave } = useEventEditor(event?.id, onSaved);
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EventFormInput, unknown, EventInput>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: initialValues(event, categories),
  });
  const visibility = useWatch({ control, name: "visibility" });
  const isAllDay = useWatch({ control, name: "isAllDay" });
  const onAllDayChange = useCallback(
    (checked: boolean) => {
      if (checked) {
        setValue("startTime", "", { shouldDirty: true });
        setValue("endTime", "", { shouldDirty: true });
      }
      setValue("isAllDay", checked, { shouldDirty: true });
    },
    [setValue],
  );
  const onSubmit = useCallback(
    async (input: EventInput) => {
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
        <legend className="sr-only">일정 입력</legend>
        <FormFieldRow
          label="제목"
          htmlFor="event-title"
          invalid={!!errors.title}
          error={errors.title?.message}
        >
          {(props) => <input {...props} {...register("title")} autoFocus />}
        </FormFieldRow>
        {(!event || event.canChangeVisibility) && (
          <FormFieldRow label="개인 일정" htmlFor="event-private">
            {(props) => (
              <Controller
                control={control}
                name="visibility"
                render={({ field }) => (
                  <Switch
                    {...props}
                    checked={field.value === "private"}
                    onCheckedChange={(checked) =>
                      field.onChange(checked ? "private" : "shared")
                    }
                    aria-label="개인 일정"
                  />
                )}
              />
            )}
          </FormFieldRow>
        )}
        <Text as="p" variant="caption" className="text-muted-foreground">
          {eventVisibility[visibility]}
        </Text>
        <FormFieldRow label="종일" htmlFor="event-all-day">
          {(props) => (
            <Switch
              {...props}
              checked={isAllDay}
              onCheckedChange={onAllDayChange}
            />
          )}
        </FormFieldRow>
        <FormFieldRow
          label="시작"
          htmlFor="event-start"
          invalid={!!errors.startDate}
          error={errors.startDate?.message}
        >
          {(props) => (
            <input {...props} {...register("startDate")} type="date" />
          )}
        </FormFieldRow>
        <FormFieldRow
          label="종료"
          htmlFor="event-end"
          invalid={!!errors.endDate}
          error={errors.endDate?.message}
        >
          {(props) => <input {...props} {...register("endDate")} type="date" />}
        </FormFieldRow>
        {!isAllDay && (
          <>
            <FormFieldRow
              label="시작 시각 (선택)"
              htmlFor="event-start-time"
              invalid={!!errors.startTime}
              error={errors.startTime?.message}
            >
              {(props) => (
                <input {...props} {...register("startTime")} type="time" />
              )}
            </FormFieldRow>
            <FormFieldRow
              label="종료 시각 (선택)"
              htmlFor="event-end-time"
              invalid={!!errors.endTime}
              error={errors.endTime?.message}
            >
              {(props) => (
                <input {...props} {...register("endTime")} type="time" />
              )}
            </FormFieldRow>
            <Text as="p" variant="caption" className="text-muted-foreground">
              시각을 모두 비우면 시간 미정으로 저장돼요.
            </Text>
          </>
        )}
        <FormFieldRow
          label="카테고리"
          htmlFor="event-category"
          invalid={!!errors.categoryId}
          error={errors.categoryId?.message}
        >
          {(props) => (
            <select {...props} {...register("categoryId")}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          )}
        </FormFieldRow>
        <FormFieldRow label="장소" htmlFor="event-place">
          {(props) => <input {...props} {...register("place")} />}
        </FormFieldRow>
        <FormFieldRow label="메모" htmlFor="event-memo">
          {(props) => <textarea {...props} {...register("memo")} rows={3} />}
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
