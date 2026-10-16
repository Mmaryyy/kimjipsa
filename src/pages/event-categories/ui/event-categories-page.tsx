"use client";
import { useState } from "react";
import { useEventCategories, type EventCategory } from "@/entities/event";
import {
  Button,
  CategoryDot,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  List,
  ListRow,
  ListSkeleton,
  PageHeader,
  Sheet,
  Text,
  TextButton,
} from "@/shared/ui";
import { useCategoryEditor } from "../model/use-category-editor";
import { EventCategoryForm } from "./event-category-form";
function CategoryRow({
  category,
  onEdit,
}: {
  category: EventCategory;
  onEdit: (category: EventCategory) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const { onDelete, deleting, deleteError } = useCategoryEditor(
    category.id,
    () => setConfirming(false),
  );
  return (
    <ListRow
      leading={<CategoryDot color={category.color} />}
      trailing={
        <div className="flex gap-2">
          <TextButton
            onClick={() => onEdit(category)}
            aria-label={`${category.name} 수정하기`}
          >
            수정하기
          </TextButton>
          {category.name !== "기타" && (
            <TextButton
              tone="danger"
              onClick={() => setConfirming(true)}
              aria-label={`${category.name} 삭제하기`}
            >
              삭제하기
            </TextButton>
          )}
        </div>
      }
    >
      <Text className="break-words">{category.name}</Text>
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
        targetName={category.name}
        title="카테고리를 삭제할까요?"
        description={
          deleteError?.message ?? "이 카테고리의 일정은 기타로 옮겨져요."
        }
        onConfirm={onDelete}
        pending={deleting}
      />
    </ListRow>
  );
}
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
  return (
    <List>
      {categories.data.map((category) => (
        <CategoryRow key={category.id} category={category} onEdit={onEdit} />
      ))}
    </List>
  );
}
export function EventCategoriesPage() {
  const [editing, setEditing] = useState<EventCategory | null | undefined>(
    undefined,
  );
  return (
    <>
      <PageHeader
        title="일정 카테고리"
        actions={
          <Button onClick={() => setEditing(null)}>카테고리 만들기</Button>
        }
      />
      <CategoryList onEdit={setEditing} />
      <Sheet
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
        title={editing ? "카테고리 수정" : "카테고리 만들기"}
        description="가정에서 함께 쓸 일정 카테고리 이름과 색을 정해요."
      >
        {editing !== undefined && (
          <EventCategoryForm
            key={editing?.id ?? "new"}
            category={editing ?? undefined}
            onSaved={() => setEditing(undefined)}
          />
        )}
      </Sheet>
    </>
  );
}
