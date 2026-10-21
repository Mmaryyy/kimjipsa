"use client";
import { cn } from "@/shared/lib";

import { useCallback, type FormEvent } from "react";
import {
  Controller,
  useForm,
  useWatch,
  type UseFormRegister,
  type FieldErrors,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  type CalendarEvent,
  type EventCategory,
  type EventInput,
  eventDateInput,
  reminderOptions,
} from "@/entities/event";
import {
  Button,
  CategoryDot,
  FormFieldRow,
  GroupLabel,
  Switch,
  Text,
} from "@/shared/ui";
import {
  eventFormSchema,
  type EventFormInput,
} from "../model/event-form.schema";
import { useEventEditor } from "../model/use-event-editor";
function initialValues(
  event: CalendarEvent | undefined,
  categories: EventCategory[],
  initialDate?: string,
): EventFormInput {
  const now = new Date();
  return {
    remindBefore: event?.remindBefore === undefined ? 30 : event.remindBefore,
    kind: event?.kind ?? "event",
    ddayStyle: event?.details?.ddayStyle ?? "normal",
    celebrateMessage: event?.details?.celebrateMessage ?? "",
    title: event?.details?.title ?? "",
    place: event?.details?.place ?? "",
    memo: event?.details?.memo ?? "",
    categoryId: event?.details?.categoryId ?? categories[0]?.id ?? "",
    visibility: event?.visibility ?? "shared",
    isAllDay: event?.isAllDay ?? false,
    startDate:
      event?.startDate ?? initialDate ?? eventDateInput(now.toISOString()),
    endDate: event?.endDate ?? initialDate ?? eventDateInput(now.toISOString()),
    startTime: event?.startTime ?? "",
    endTime: event?.endTime ?? "",
  };
}
function EventDateField({
  prefix,
  isAllDay,
  register,
  errors,
}: {
  prefix: "start" | "end";
  isAllDay: boolean;
  register: UseFormRegister<EventFormInput>;
  errors: FieldErrors<EventFormInput>;
}) {
  const dateField = prefix === "start" ? "startDate" : "endDate";
  const timeField = prefix === "start" ? "startTime" : "endTime";
  const label = prefix === "start" ? "시작" : "종료";
  const error = errors[dateField]?.message ?? errors[timeField]?.message;
  return (
    <FormFieldRow
      label={label}
      htmlFor={`event-${prefix}`}
      invalid={Boolean(error)}
      error={error}
    >
      {(props) => (
        <div
          className={cn([
            "flex min-w-0 items-center justify-end gap-2 [&_input[type=date]]:min-w-0",
            "[&_input[type=date]]:w-32 [&_input[type=time]]:min-w-0 [&_input[type=time]]:w-22",
          ])}
        >
          <input
            {...props}
            data-od-id={`f-${prefix}-date`}
            {...register(dateField)}
            type="date"
          />
          {!isAllDay && (
            <input
              id={`event-${prefix}-time`}
              aria-label={`${label} 시각 (선택)`}
              aria-invalid={Boolean(errors[timeField]) || undefined}
              aria-describedby={props["aria-describedby"]}
              data-od-id={`f-${prefix}-time`}
              {...register(timeField)}
              type="time"
            />
          )}
        </div>
      )}
    </FormFieldRow>
  );
}

export function EventForm({
  event,
  categories,
  onSaved,
  formId,
  initialDate,
}: {
  event?: CalendarEvent;
  categories: EventCategory[];
  onSaved: () => void;
  formId?: string;
  initialDate?: string;
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
    defaultValues: initialValues(event, categories, initialDate),
  });
  const isAllDay = useWatch({ control, name: "isAllDay" });
  const kind = useWatch({ control, name: "kind" });
  const ddayStyle = useWatch({ control, name: "ddayStyle" });
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
  const onFormSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      if (isSubmitting) {
        event.preventDefault();
        return;
      }
      void handleSubmit(onSubmit)(event);
    },
    [handleSubmit, onSubmit, isSubmitting],
  );
  const categoryId = useWatch({ control, name: "categoryId" });
  const category = categories.find((category) => category.id === categoryId);
  return (
    <form
      id={formId}
      onSubmit={onFormSubmit}
      aria-busy={isSubmitting}
      className="grid gap-3"
      noValidate
    >
      <fieldset disabled={isSubmitting} className="grid min-w-0 gap-2">
        <legend className="sr-only">일정 입력</legend>
        <FormFieldRow
          label="제목"
          htmlFor="event-title"
          invalid={!!errors.title}
          error={errors.title?.message}
        >
          {(props) => (
            <input
              {...props}
              data-od-id="f-title"
              {...register("title")}
              autoFocus
            />
          )}
        </FormFieldRow>
        <FormFieldRow label="장소" htmlFor="event-place">
          {(props) => (
            <input {...props} data-od-id="f-place" {...register("place")} />
          )}
        </FormFieldRow>
        <GroupLabel>시간</GroupLabel>
        {kind !== "dday" && (
          <FormFieldRow label="종일" htmlFor="event-all-day">
            {(props) => (
              <Switch
                {...props}
                data-od-id="f-allday"
                checked={isAllDay}
                onCheckedChange={onAllDayChange}
              />
            )}
          </FormFieldRow>
        )}
        <EventDateField
          prefix="start"
          isAllDay={isAllDay || kind === "dday"}
          register={register}
          errors={errors}
        />
        {kind !== "dday" && (
          <EventDateField
            prefix="end"
            isAllDay={isAllDay}
            register={register}
            errors={errors}
          />
        )}
        {kind !== "dday" && !isAllDay && (
          <Text as="p" variant="caption" className="text-muted-foreground">
            시각을 모두 비우면 시간 미정으로 저장돼요.
          </Text>
        )}
        <FormFieldRow
          label="알림"
          htmlFor="event-remind"
          invalid={!!errors.remindBefore}
          error={errors.remindBefore?.message}
        >
          {(props) => (
            <Controller
              control={control}
              name="remindBefore"
              render={({ field }) => (
                <select
                  {...props}
                  data-od-id="f-remind"
                  value={field.value === null ? "none" : field.value}
                  onChange={(event) =>
                    field.onChange(
                      event.target.value === "none"
                        ? null
                        : Number(event.target.value),
                    )
                  }
                >
                  {reminderOptions.map((option) => (
                    <option
                      key={String(option.value)}
                      value={option.value ?? "none"}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            />
          )}
        </FormFieldRow>
        <GroupLabel>분류</GroupLabel>
        <FormFieldRow
          label="카테고리"
          htmlFor="event-category"
          invalid={!!errors.categoryId}
          error={errors.categoryId?.message}
        >
          {(props) => (
            <div className="flex items-center gap-2">
              {category && <CategoryDot color={category.color} />}
              <select
                {...props}
                data-od-id="f-category"
                {...register("categoryId")}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          )}
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
                    data-od-id="f-private"
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
          기본은 둘 다 참석하는 공유 일정이에요.
        </Text>
        <FormFieldRow label="일정 종류" htmlFor="event-kind">
          {(props) => (
            <select {...props} {...register("kind")}>
              <option value="event">일정</option>
              <option value="dday">D-day</option>
            </select>
          )}
        </FormFieldRow>
        {kind === "dday" && (
          <>
            <FormFieldRow
              label="D-day 종류"
              htmlFor="event-dday-style"
              error={errors.ddayStyle?.message}
              invalid={!!errors.ddayStyle}
            >
              {(props) => (
                <select {...props} {...register("ddayStyle")}>
                  <option value="normal">일반</option>
                  <option value="celebrate">축하</option>
                </select>
              )}
            </FormFieldRow>
            {ddayStyle === "celebrate" && (
              <FormFieldRow
                label="축하 문구 (선택)"
                htmlFor="event-celebrate-message"
                error={errors.celebrateMessage?.message}
                invalid={!!errors.celebrateMessage}
              >
                {(props) => (
                  <input
                    {...props}
                    {...register("celebrateMessage")}
                    placeholder="소중한 날을 축하해요!"
                  />
                )}
              </FormFieldRow>
            )}
          </>
        )}
        <GroupLabel>메모</GroupLabel>
        <FormFieldRow label="메모" htmlFor="event-memo">
          {(props) => (
            <textarea
              {...props}
              data-od-id="f-memo"
              {...register("memo")}
              rows={3}
            />
          )}
        </FormFieldRow>
      </fieldset>
      {errors.root && (
        <Text as="p" role="alert" className="text-error-text">
          {errors.root.message}
        </Text>
      )}
      {!formId && (
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "저장하고 있어요" : "저장하기"}
        </Button>
      )}
    </form>
  );
}
