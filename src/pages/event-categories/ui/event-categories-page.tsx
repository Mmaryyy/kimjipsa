"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Plus } from "lucide-react";
import { useEventCategories, type EventCategory } from "@/entities/event";
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
  PageLayout,
  Sheet,
  TextButton,
} from "@/shared/ui";
import { settingsPath } from "@/shared/config";
import { SortableCategoryList } from "./sortable-category-list";
import { EventCategoryForm } from "./event-category-form";

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
  const [editing, setEditing] = useState<EventCategory | null | undefined>(
    undefined,
  );
  return (
    <PageLayout
      width="narrow"
      odId="lists-main"
      header={
        <PageHeader
          odId="lists"
          title="일정 카테고리"
          navigation={
            <Link
              href={settingsPath}
              data-od-id="lists-back"
              className="inline-flex min-h-11 items-center gap-1 text-primary"
            >
              <ChevronLeft size={20} />
              설정
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
        <TextButton
          className="mt-3"
          data-od-id="lists-add"
          onClick={() => setEditing(null)}
        >
          <Plus size={18} />
          카테고리 추가
        </TextButton>
      </section>
      <Sheet
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
        odId="lists-sheet"
        leadingAction={(onOpenChange) => (
          <TextButton onClick={() => onOpenChange(false)}>취소</TextButton>
        )}
        title={editing ? "카테고리 수정" : "새 카테고리"}
        action={
          <TextButton
            data-od-id="lists-save"
            type="submit"
            form="category-form"
          >
            저장
          </TextButton>
        }
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
    </PageLayout>
  );
}
