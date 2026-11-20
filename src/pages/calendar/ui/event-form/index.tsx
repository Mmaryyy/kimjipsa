"use client";
import { useMediaQuery } from "@/shared/lib";
import { useCallback, useEffect, type FormEvent, type ReactNode } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  type CalendarEvent,
  type EventCategory,
  reminderOptions,
  recurrenceOptions,
} from "@/entities/event";
import type { Todo, TodoFields } from "@/entities/todo";
import {
  Button,
  useConfirm,
  CategoryDot,
  FormField,
  GroupLabel,
  Select,
  Switch,
  Text,
} from "@/shared/ui";
import {
  calendarFormSchema,
  type CalendarFormOutput,
  type EventFormInput,
} from "../../model/event-form.schema";
import { useEventEditor } from "../../model/use-event-editor";
import { DateTimeInput, defaultDateRange } from "@/shared/ui/date-time-input";
import { EventDateFields } from "../event-date-fields";
const Field = FormField<EventFormInput>;
const kindOptions = [
  { value: "event", label: "일정" },
  { value: "dday", label: "D-day" },
  { value: "todo", label: "할 일" },
] as const;

function TodoDueDateField() {
  return (
    <FormField<EventFormInput, "due_on">
      name="due_on"
      label="마감일 (선택)"
      render={({ value, onChange, ...controlProps }) => (
        <DateTimeInput
          label="마감일"
          controlProps={controlProps}
          range={{
            startDate: value ?? "",
            endDate: value ?? "",
            startTime: "",
            endTime: "",
          }}
          dateOnly
          singleDate
          variant="field"
          pickerOdId="todo-due-date"
          onClear={value ? () => onChange(null) : undefined}
          onConfirm={(range) => onChange(range.startDate || null)}
        />
      )}
    />
  );
}

function initialValues(
  event: CalendarEvent | undefined,
  categories: EventCategory[],
  initialDate?: string,
  todo?: Todo,
): EventFormInput {
  const defaults = defaultDateRange(initialDate);
  return {
    recurrence: event?.recurrence ?? null,
    remindBefore: event?.remindBefore === undefined ? 30 : event.remindBefore,
    kind: todo ? "todo" : (event?.kind ?? "event"),
    due_on: todo?.due_on ?? null,
    ddayStyle: event?.details?.ddayStyle ?? "normal",
    celebrateMessage: event?.details?.celebrateMessage ?? "",
    title: todo?.title ?? event?.details?.title ?? "",
    place: event?.details?.place ?? "",
    memo: event?.details?.memo ?? "",
    categoryId: event?.details?.categoryId ?? categories[0]?.id ?? "",
    visibility: todo?.visibility ?? event?.visibility ?? "shared",
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
const EventForm = ({
  event,
  todo,
  todoUserId,
  onSaveTodo,
  categories,
  categoryStatus,
  onSaved,
  formId,
  initialDate,
  onDirtyChange,
}: {
  event?: CalendarEvent;
  todo?: Todo;
  todoUserId?: string;
  onSaveTodo?: (item: TodoFields) => Promise<void>;
  categoryStatus?: ReactNode;
  categories: EventCategory[];
  onSaved: () => void;
  formId?: string;
  initialDate?: string;
  onDirtyChange?: (dirty: boolean) => void;
}) => {
  const confirm = useConfirm();
  const coarse = useMediaQuery("(pointer: coarse)");
  const { onSave } = useEventEditor(event?.id, onSaved);
  const form = useForm<EventFormInput, unknown, CalendarFormOutput>({
    resolver: zodResolver(calendarFormSchema),
    defaultValues: initialValues(event, categories, initialDate, todo),
  });
  const {
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = form;
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);
  const isAllDay = useWatch({ control, name: "isAllDay" });
  const isTimeUnknown = useWatch({ control, name: "isTimeUnknown" });
  const kind = useWatch({ control, name: "kind" });
  const isTodo = kind === "todo";
  const privateLabel = isTodo ? "개인 할 일" : "개인 일정";
  const canChangeVisibility = todo
    ? todo.owner_id === todoUserId
    : !event || event.canChangeVisibility;
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
  const persist = useCallback(
    async (input: CalendarFormOutput) => {
      try {
        if (input.kind === "todo") {
          if (!onSaveTodo || event) return;
          await onSaveTodo(input.item);
          onSaved();
        } else {
          await onSave(input);
        }
        return true;
      } catch (error) {
        setError("root", {
          message:
            error instanceof Error ? error.message : "저장하지 못했어요.",
        });
        return false;
      }
    },
    [event, onSave, onSaved, onSaveTodo, setError],
  );
  const onSubmit = useCallback(
    async (input: CalendarFormOutput) => {
      if (input.kind === "todo" || !event?.recurrence) {
        await persist(input);
        return;
      }
      await confirm({
        title: "어떤 일정을 수정할까요?",
        description:
          input.visibility !== event.visibility
            ? "공개 범위 변경은 시리즈 전체에 적용돼요."
            : "변경할 반복 일정의 범위를 선택해 주세요.",
        destructive: false,
        confirmLabel: "이후 모든 일정",
        onConfirm: () => onSave({ ...input, scope: "following" }),
        secondaryAction:
          input.recurrence === event.recurrence && input.kind === "event"
            ? {
                label: "이 일정만",
                onClick: () => onSave({ ...input, scope: "single" }),
              }
            : undefined,
      });
    },
    [event, persist, confirm, onSave],
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
    <FormProvider {...form}>
      <form
        id={formId}
        onSubmit={onFormSubmit}
        aria-busy={isSubmitting}
        className="grid gap-3"
        noValidate
      >
        <fieldset disabled={isSubmitting} className="grid min-w-0 gap-2">
          <legend className="sr-only">일정 입력</legend>
          {!isTodo && (
            <>
              <GroupLabel>분류</GroupLabel>
              {categoryStatus ?? (
                <Field
                  name="categoryId"
                  label="카테고리"
                  render={(field) => (
                    <div className="flex items-center gap-2">
                      {category && <CategoryDot color={category.color} />}
                      <Select {...field} variant="row" data-od-id="f-category">
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                />
              )}
            </>
          )}
          {canChangeVisibility && (
            <Field
              name="visibility"
              label={privateLabel}
              render={(field) => (
                <Switch
                  {...field}
                  value={undefined}
                  data-od-id="f-private"
                  checked={field.value === "private"}
                  onCheckedChange={(checked) =>
                    field.onChange(checked ? "private" : "shared")
                  }
                  aria-label={privateLabel}
                />
              )}
            />
          )}
          {!isTodo && (
            <Text as="p" variant="caption" className="text-muted-foreground">
              기본은 가족 모두가 함께 보는 공유 일정이에요.
            </Text>
          )}
          <Field
            name="kind"
            label="일정 종류"
            type="select"
            disabled={Boolean(event || todo)}
            options={kindOptions}
          />
          {kind === "dday" && (
            <Field
              name="ddayStyle"
              label="D-day 종류"
              type="select"
              options={[
                { value: "normal", label: "일반" },
                { value: "celebrate", label: "축하" },
              ]}
            />
          )}
          <Field
            name="title"
            label="제목"
            inputProps={{ "data-od-id": "f-title", autoFocus: !coarse }}
          />
          {isTodo ? (
            <TodoDueDateField />
          ) : (
            <>
              <GroupLabel>시간</GroupLabel>
              {kind !== "dday" && (
                <Field
                  name="isAllDay"
                  label="종일"
                  render={(field) => (
                    <Switch
                      {...field}
                      value={undefined}
                      data-od-id="f-allday"
                      checked={field.value}
                      onCheckedChange={onAllDayChange}
                    />
                  )}
                />
              )}
              {kind !== "dday" && (
                <Field
                  name="isTimeUnknown"
                  label="시간 미정"
                  render={(field) => (
                    <Switch
                      {...field}
                      value={undefined}
                      data-od-id="f-time-unknown"
                      checked={field.value}
                      onCheckedChange={onTimeUnknownChange}
                    />
                  )}
                />
              )}
              <EventDateFields
                control={control}
                setValue={setValue}
                dateOnly={isAllDay || isTimeUnknown || kind === "dday"}
                singleDate={kind === "dday"}
              />
              {kind !== "dday" && !isAllDay && !isTimeUnknown && (
                <Text
                  as="p"
                  variant="caption"
                  className="text-muted-foreground"
                >
                  시각을 정하지 않았다면 시간 미정을 켜 주세요.
                </Text>
              )}
              {kind !== "dday" && (
                <Field
                  name="recurrence"
                  label="반복"
                  type="select"
                  noneLabel="안 함"
                  options={recurrenceOptions.filter(
                    (option) => option.value !== "none",
                  )}
                  inputProps={{ "data-od-id": "f-recurrence" }}
                />
              )}
              <Field
                name="remindBefore"
                label="알림"
                type="select"
                noneLabel="없음"
                options={reminderOptions.filter(
                  (option) => option.value !== null,
                )}
                inputProps={{ "data-od-id": "f-remind" }}
              />
              <Field
                name="place"
                label="장소"
                inputProps={{ "data-od-id": "f-place" }}
              />
              {kind === "dday" && ddayStyle === "celebrate" && (
                <Field
                  name="celebrateMessage"
                  label="축하 문구 (선택)"
                  inputProps={{ placeholder: "소중한 날을 축하해요!" }}
                />
              )}
              <GroupLabel>메모</GroupLabel>
              <Field
                name="memo"
                label="메모"
                type="textarea"
                inputProps={{ "data-od-id": "f-memo", rows: 3 }}
              />
            </>
          )}
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
    </FormProvider>
  );
};

export default EventForm;
