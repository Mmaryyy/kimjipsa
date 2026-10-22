"use client";
import { useCallback, useEffect, type FormEvent } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  type CalendarEvent,
  type EventCategory,
  type EventInput,
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
import { defaultDateRange } from "@/shared/ui/date-time-input";
import { EventDateFields } from "./event-date-fields";
function initialValues(
  event: CalendarEvent | undefined,
  categories: EventCategory[],
  initialDate?: string,
): EventFormInput {
  const defaults = defaultDateRange(initialDate);
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
    isTimeUnknown: Boolean(
      event && !event.isAllDay && !event.startTime && !event.endTime,
    ),
    startDate: event?.startDate ?? defaults.startDate,
    endDate: event?.endDate ?? defaults.endDate,
    startTime: event ? (event.startTime ?? "") : defaults.startTime,
    endTime: event ? (event.endTime ?? "") : defaults.endTime,
  };
}
export function EventForm({
  event,
  categories,
  onSaved,
  formId,
  initialDate,
  onDirtyChange,
}: {
  event?: CalendarEvent;
  categories: EventCategory[];
  onSaved: () => void;
  formId?: string;
  initialDate?: string;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { onSave } = useEventEditor(event?.id, onSaved);
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EventFormInput, unknown, EventInput>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: initialValues(event, categories, initialDate),
  });
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);
  const isAllDay = useWatch({ control, name: "isAllDay" });
  const isTimeUnknown = useWatch({ control, name: "isTimeUnknown" });
  const kind = useWatch({ control, name: "kind" });
  const ddayStyle = useWatch({ control, name: "ddayStyle" });
  const onAllDayChange = useCallback(
    (checked: boolean) => {
      if (checked) {
        setValue("isTimeUnknown", false, { shouldDirty: true });
        setValue("startTime", "", { shouldDirty: true });
        setValue("endTime", "", { shouldDirty: true });
      }
      setValue("isAllDay", checked, { shouldDirty: true });
    },
    [setValue],
  );
  const onTimeUnknownChange = useCallback(
    (checked: boolean) => {
      setValue("isTimeUnknown", checked, { shouldDirty: true });
      if (checked) {
        setValue("isAllDay", false, { shouldDirty: true });
        setValue("startTime", "", { shouldDirty: true });
        setValue("endTime", "", { shouldDirty: true });
      }
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
        {kind !== "dday" && (
          <FormFieldRow label="시간 미정" htmlFor="event-time-unknown">
            {(props) => (
              <Switch
                {...props}
                data-od-id="f-time-unknown"
                checked={isTimeUnknown}
                onCheckedChange={onTimeUnknownChange}
              />
            )}
          </FormFieldRow>
        )}
        <EventDateFields
          control={control}
          register={register}
          setValue={setValue}
          errors={errors}
          dateOnly={isAllDay || isTimeUnknown || kind === "dday"}
          singleDate={kind === "dday"}
        />
        {kind !== "dday" && !isAllDay && !isTimeUnknown && (
          <Text as="p" variant="caption" className="text-muted-foreground">
            시각을 정하지 않았다면 시간 미정을 켜 주세요.
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
          기본은 가족 모두가 함께 보는 공유 일정이에요.
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
