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
} from "@/shared/ui";
import { eventRoutes, settingsPath } from "@/shared/config";
import { useHistoryBack } from "@/shared/lib";
import SortableCategoryList from "./sortable-category-list";
import EventCategoryForm from "./event-category-form";

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
  const [editing, setEditing] = useState<EventCategory | null | undefined>(
    undefined,
  );
  const [dirty, setDirty] = useState(false);
  const close = () => {
    setDirty(false);
    setEditing(undefined);
  };
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
              onClick={() => setEditing(null)}
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
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        odId="lists-sheet"
        dirty={dirty}
        submitOdId="lists-save"
        title={editing ? "카테고리 수정" : "새 카테고리"}
        description="가정에서 함께 쓸 일정 카테고리 이름과 색을 정해요."
      >
        {(formId) =>
          editing !== undefined && (
            <EventCategoryForm
              key={editing?.id ?? "new"}
              formId={formId}
              onDirtyChange={setDirty}
              category={editing ?? undefined}
              onSaved={close}
            />
          )
        }
      </FormSheet>
    </PageLayout>
  );
}
