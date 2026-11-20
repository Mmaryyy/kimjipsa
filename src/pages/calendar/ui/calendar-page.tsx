"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useSearchParams } from "next/navigation";
import {
  todoSchedule,
  useTodos,
  useTodoWrite,
  type Todo,
  type TodoCommand,
  type TodoFields,
} from "@/entities/todo";
import { useFamily } from "@/features/family";
import { CalendarView } from "@/widgets/calendar-view";
import {
  DdayOverview,
  EventListSkeleton,
  calendarDdayLimit,
  useEvents,
  useEvent,
  useEventCategories,
  eventDateInput,
  useCalendarClock,
} from "@/entities/event";
import {
  EmptyState,
  ErrorState,
  FormSheet,
  ListSkeleton,
  PageLayout,
  PullToAdd,
  Toast,
} from "@/shared/ui";
import { useEventDelete } from "../model/use-event-delete";
import EventForm from "./event-form";
import EventFormSkeleton from "./event-form/Skeleton";
import EventDetail from "./event-detail";

function groupTodosByDate(items: Todo[], today: string) {
  const scheduled = items.map((todo) => {
    const { date, overdueDays } = todoSchedule(todo, today);
    return { date, todo, overdueDays };
  });
  return Map.groupBy(scheduled, (item) => item.date);
}

function EventList({
  onOpen,
  onAdd,
  instant,
  todos,
  todoBusy,
  onToggleTodo,
  onEditTodo,
  onDeleteTodo,
}: {
  onOpen: (id: string, action?: "edit" | "delete") => void;
  onAdd: () => void;
  instant: Date;
  todos: ReturnType<typeof useTodos>;
  todoBusy: boolean;
  onToggleTodo: (todo: Todo, done: boolean) => void;
  onEditTodo: (todo: Todo) => void;
  onDeleteTodo: (todo: Todo) => void;
}) {
  const params = useSearchParams();
  const selected = z.iso.date().safeParse(params?.get("date"));
  const year = Number(
    (selected.success
      ? selected.data
      : eventDateInput(instant.toISOString())
    ).slice(0, 4),
  );
  const events = useEvents({
    start: `${Math.max(1, year - 1)}-01-01`,
    end: `${Math.min(9999, year + 1)}-12-31`,
  });
  const family = useFamily();
  const categories = useEventCategories();
  if (events.isError)
    return (
      <ErrorState
        message={events.error.message}
        onRetry={() => {
          void events.refetch();
        }}
      />
    );
  if (categories.isError)
    return (
      <ErrorState
        message={categories.error.message}
        onRetry={() => {
          void categories.refetch();
        }}
      />
    );
  if (family.isError)
    return (
      <ErrorState
        message={family.error.message}
        onRetry={() => {
          void family.refetch();
        }}
      />
    );
  const loading = events.isPending || categories.isPending || family.isPending;
  const today = eventDateInput(instant.toISOString());
  const items = todos.data?.items ?? [];
  const todoActions = {
    onEdit: onEditTodo,
    onDelete: onDeleteTodo,
    onToggle: onToggleTodo,
  };
  const retryTodos = () => void todos.refetch();
  let todoStatus;
  if (todos.error) {
    todoStatus = (
      <ErrorState message={todos.error.message} onRetry={retryTodos} />
    );
  } else if (todos.isPending) {
    todoStatus = <ListSkeleton label="할 일을 불러오고 있어요" />;
  }
  return (
    <div className="grid gap-10">
      <CalendarView
        loading={loading}
        ownerNames={Object.fromEntries(
          (family.data?.members ?? []).map((member) => [
            member.user_id,
            member.display_name,
          ]),
        )}
        events={events.data ?? []}
        categories={categories.data ?? []}
        today={today}
        todosByDate={groupTodosByDate(
          items.filter((todo) => todo.due_on),
          today,
        )}
        undatedTodosByDate={groupTodosByDate(
          items.filter((todo) => !todo.due_on),
          today,
        )}
        todoBusy={todoBusy || todos.isError}
        onToggleTodo={onToggleTodo}
        onOpen={onOpen}
        onAdd={onAdd}
        todoActions={todoActions}
        todoStatus={todoStatus}
      />
      {loading ? (
        <EventListSkeleton title="D-day" dday />
      ) : (
        <DdayOverview
          events={events.data ?? []}
          categories={categories.data ?? []}
          instant={instant}
          onOpen={onOpen}
          limit={calendarDdayLimit}
        />
      )}
    </div>
  );
}

function NewEvent({
  onSaved,
  onSaveTodo,
  initialDate,
  formId,
  onDirtyChange,
}: {
  onSaved: () => void;
  onSaveTodo: (item: TodoFields) => Promise<void>;
  initialDate?: string;
  formId: string;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const categories = useEventCategories();
  if (categories.isPending) return <EventFormSkeleton />;
  const availableCategories = categories.isError ? [] : categories.data;
  let categoryStatus;
  if (categories.isError) {
    categoryStatus = (
      <ErrorState
        message={categories.error.message}
        onRetry={() => void categories.refetch()}
      />
    );
  } else if (!availableCategories.length) {
    categoryStatus = (
      <EmptyState message="카테고리가 없어요. 가정 설정에서 추가해 주세요." />
    );
  }
  return (
    <EventForm
      onDirtyChange={onDirtyChange}
      formId={formId}
      initialDate={initialDate}
      categories={availableCategories}
      categoryStatus={categoryStatus}
      onSaveTodo={onSaveTodo}
      onSaved={onSaved}
    />
  );
}
function EventDeleteConfirmation({
  id,
  onClose,
  onFailure,
}: {
  id: string;
  onClose: () => void;
  onFailure: (message: string) => void;
}) {
  const event = useEvent(id);
  const { remove } = useEventDelete(event.data, onClose);
  const started = useRef(false);
  useEffect(() => {
    if (started.current || event.isPending) return;
    started.current = true;
    if (event.isError || !event.data?.canEdit || !event.data.details) {
      onFailure(
        event.isError
          ? event.error.message
          : "일정을 찾을 수 없거나 삭제할 수 없어요.",
      );
      onClose();
      return;
    }
    void remove().then((confirmed) => {
      if (!confirmed) onClose();
    });
  });
  return null;
}

function CalendarContent() {
  const params = useSearchParams();
  const parsedDate = z.iso.date().safeParse(params?.get("date"));
  const initialDate = parsedDate.success ? parsedDate.data : undefined;
  const parsedEvent = z
    .string()
    .regex(/^[0-9a-f-]{36}(~\d{4}-\d{2}-\d{2})?$/i)
    .safeParse(params?.get("event"));
  const [sheet, setSheet] = useState<{
    mode: "closed" | "new" | "view" | "delete";
    id: string | null;
    action?: "edit";
  }>({
    mode: parsedEvent.success
      ? params?.get("action") === "delete"
        ? "delete"
        : "view"
      : params?.get("create") === "1"
        ? "new"
        : "closed",
    id: parsedEvent.success ? parsedEvent.data : null,
    action: params?.get("action") === "edit" ? "edit" : undefined,
  });
  const instant = useCalendarClock();
  const todos = useTodos();
  const todoWrite = useTodoWrite();
  const [editor, setEditor] = useState<Todo | null>(null);
  const [deleted, setDeleted] = useState<Todo | null>(null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const close = () => {
    setDirty(false);
    setEditor(null);
    setSheet({ mode: "closed", id: null });
  };
  const openNew = () => setSheet({ mode: "new", id: null });
  const writeTodo = async (command: TodoCommand) => {
    if (todoWrite.isPending) return;
    try {
      await todoWrite.mutateAsync(command);
      if (command.action === "undo") {
        setDeleted(null);
        setMessage("할 일을 되돌렸어요");
      }
    } catch (error) {
      setDeleted(null);
      setMessage(
        error instanceof Error ? error.message : "할 일을 변경하지 못했어요.",
      );
    }
  };
  const toggleTodo = (todo: Todo, done: boolean) =>
    void writeTodo({ action: "set_done", id: todo.id, done });
  const removeTodo = async (todo: Todo) => {
    if (todoWrite.isPending) return;
    try {
      await todoWrite.mutateAsync({ action: "delete", id: todo.id });
      setDeleted(todo);
      setMessage("");
    } catch (error) {
      setDeleted(null);
      setMessage(
        error instanceof Error ? error.message : "할 일을 삭제하지 못했어요.",
      );
    }
  };
  const saveTodo = async (item: TodoFields) => {
    await todoWrite.mutateAsync({ action: "save", id: editor?.id, item });
    setDeleted(null);
    setMessage(editor ? "할 일을 수정했어요" : "할 일을 등록했어요");
  };
  return (
    <PullToAdd
      action="일정 등록하기"
      onAdd={openNew}
      disabled={sheet.mode !== "closed" || !!editor}
    >
      <PageLayout width="wide" odId="calendar-main">
        {(message || deleted) && (
          <Toast
            open
            key={deleted?.id ?? message}
            message={deleted ? `${deleted.title} 지웠어요` : message}
            action={
              deleted
                ? {
                    label: "되돌리기",
                    onClick: () =>
                      void writeTodo({ action: "undo", id: deleted.id }),
                  }
                : undefined
            }
            onOpenChange={(open) => {
              if (!open) {
                setMessage("");
                setDeleted(null);
              }
            }}
          />
        )}
        <EventList
          onOpen={(id, action) =>
            setSheet({
              mode: action === "delete" ? "delete" : "view",
              id,
              action: action === "edit" ? "edit" : undefined,
            })
          }
          onAdd={openNew}
          instant={instant}
          todos={todos}
          todoBusy={todoWrite.isPending}
          onToggleTodo={toggleTodo}
          onEditTodo={setEditor}
          onDeleteTodo={(todo) => void removeTodo(todo)}
        />
        <FormSheet
          dirty={dirty}
          pending={todoWrite.isPending}
          open={sheet.mode === "new" || !!editor}
          onOpenChange={(open) => {
            if (!open) close();
          }}
          title={editor ? "할 일 수정" : "새 일정"}
          odId={editor ? "sheet-edit-todo" : "sheet-new-event"}
          submitLabel={editor ? "저장" : "추가"}
          submitDisabled={!!editor && !dirty}
          submitOdId="new-save"
          cancelOdId="new-cancel"
          description={
            editor
              ? "할 일 제목과 마감일, 공개 범위를 변경해요."
              : "등록할 종류와 제목, 공개 범위를 설정해요."
          }
        >
          {(formId) => {
            if (editor) {
              return (
                <EventForm
                  key={editor.id}
                  todo={editor}
                  todoUserId={todos.data?.userId}
                  categories={[]}
                  formId={formId}
                  onDirtyChange={setDirty}
                  onSaveTodo={saveTodo}
                  onSaved={close}
                />
              );
            }
            return (
              sheet.mode === "new" && (
                <NewEvent
                  formId={formId}
                  initialDate={initialDate}
                  onDirtyChange={setDirty}
                  onSaved={close}
                  onSaveTodo={saveTodo}
                />
              )
            );
          }}
        </FormSheet>
        {sheet.id && sheet.mode === "delete" && (
          <EventDeleteConfirmation
            key={sheet.id}
            id={sheet.id}
            onClose={close}
            onFailure={setMessage}
          />
        )}
        {sheet.id && sheet.mode === "view" && (
          <EventDetail
            key={`${sheet.id}-${sheet.action}`}
            id={sheet.id}
            initialAction={sheet.action}
            onClose={close}
          />
        )}
      </PageLayout>
    </PullToAdd>
  );
}

export function CalendarPage() {
  return (
    <Suspense fallback={<EventListSkeleton title="일정" />}>
      <CalendarContent />
    </Suspense>
  );
}
