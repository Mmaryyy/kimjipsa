"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useEventCategories, type EventCategory } from "@/entities/event";
import {
  Button,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
  PageLayout,
  FormSheet,
  TextButton,
  Text,
  CategoryDot,
  useConfirm,
} from "@/shared/ui";
import { eventRoutes, settingsPath } from "@/shared/config";
import { useHistoryBack } from "@/shared/lib";
import SortableCategoryList from "./sortable-category-list";
import EventCategoryForm from "./event-category-form";
import { useCategoryEditor } from "../model/use-category-editor";

function CategoryList({
  onEdit,
}: {
  onEdit: (category: EventCategory) => void;
}) {
  const categories = useEventCategories();
  if (categories.isError)
    return (
      <ErrorState
        message={categories.error.message}
        onRetry={() => {
          void categories.refetch();
        }}
      />
    );
  if (categories.isPending)
    return <ListSkeleton label="일정 카테고리를 불러오고 있어요" />;
  if (!categories.data.length)
    return (
      <EmptyState message="일정 카테고리가 없어요. 새 카테고리를 만들어 보세요." />
    );
  return <SortableCategoryList categories={categories.data} onEdit={onEdit} />;
}
export function EventCategoriesPage() {
  const searchParams = useSearchParams();
  const { onNavigate } = useHistoryBack(eventRoutes.categories);
  const fromCalendar = searchParams?.get("from") === "calendar";
  const [selected, setEditing] = useState<EventCategory | null | undefined>(
    undefined,
  );
  const categories = useEventCategories();
  const editing = selected
    ? (categories.data?.find((category) => category.id === selected.id) ??
      selected)
    : selected;
  const [dirty, setDirty] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const confirm = useConfirm();
  const close = () => {
    setEditMode(false);
    setDirty(false);
    setEditing(undefined);
  };
  const { onDelete, deleting } = useCategoryEditor(editing?.id, close);
  return (
    <PageLayout
      width="narrow"
      odId="lists-main"
      header={
        <PageHeader
          odId="lists"
          title="일정 카테고리"
          actions={
            <Button
              variant="glass"
              data-od-id="lists-add"
              onClick={() => {
                setEditMode(true);
                setEditing(null);
              }}
            >
              추가
            </Button>
          }
          navigation={
            <Link
              href={fromCalendar ? eventRoutes.calendar : settingsPath}
              onNavigate={onNavigate}
              data-od-id="lists-back"
              aria-label="뒤로"
              className="inline-flex size-11 items-center justify-center text-primary"
            >
              <ChevronLeft aria-hidden size={20} />
            </Link>
          }
        />
      }
    >
      <section
        className="mt-4"
        aria-label="일정 카테고리 목록"
        data-od-id="lists-section"
      >
        <CategoryList onEdit={setEditing} />
      </section>
      <FormSheet
        onSaved={close}
        onCancel={
          editing
            ? () => {
                setDirty(false);
                setEditMode(false);
              }
            : undefined
        }
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        odId="lists-sheet"
        dirty={dirty}
        submitOdId="lists-save"
        title={
          editing ? (editMode ? "카테고리 수정" : "카테고리") : "새 카테고리"
        }
        editable={editMode}
        pending={deleting}
        leadingAction={() =>
          editing &&
          editing.name !== "기타" && (
            <TextButton
              tone="danger"
              aria-label="카테고리 삭제"
              data-od-id="lists-delete"
              disabled={deleting}
              onClick={() =>
                void confirm({
                  targetName: editing.name,
                  title: "카테고리를 삭제할까요?",
                  description: "이 카테고리의 일정은 기타로 옮겨져요.",
                  onConfirm: onDelete,
                })
              }
            >
              삭제
            </TextButton>
          )
        }
        action={
          editing && (
            <TextButton
              aria-label="카테고리 수정"
              onClick={() => setEditMode(true)}
            >
              수정
            </TextButton>
          )
        }
        description="가정에서 함께 쓸 일정 카테고리 이름과 색을 정해요."
      >
        {(formId, onSaved) =>
          editing !== undefined &&
          (!editMode && editing ? (
            <div className="flex items-center gap-2 py-4">
              <CategoryDot color={editing.color} />
              <Text as="h2" variant="title">
                {editing.name}
              </Text>
            </div>
          ) : (
            <EventCategoryForm
              key={editing?.id ?? "new"}
              formId={formId}
              onDirtyChange={setDirty}
              category={editing ?? undefined}
              onSaved={onSaved}
            />
          ))
        }
      </FormSheet>
    </PageLayout>
  );
}
