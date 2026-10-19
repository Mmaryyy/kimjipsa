"use client";
import { useCallback, useState } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, Menu } from "lucide-react";
import type { EventCategory } from "@/entities/event";
import { cn } from "@/shared/lib";
import { CategoryDot, List, Text, TextButton, Toast } from "@/shared/ui";
import { useCategoryOrder } from "../model/use-category-order";

type CategoryRowProps = {
  category: EventCategory;
  onEdit: (category: EventCategory) => void;
  disabled: boolean;
};

function CategoryContent({ category }: { category: EventCategory }) {
  return (
    <>
      <CategoryDot color={category.color} />
      <span className="min-w-0 flex-1 truncate text-left">{category.name}</span>
      {category.name === "기타" && (
        <Text variant="caption" className="text-muted-foreground">
          기본
        </Text>
      )}
      <ChevronRight size={16} className="text-[var(--icon-tertiary)]" />
    </>
  );
}

function SortableCategoryRow({ category, onEdit, disabled }: CategoryRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id, disabled });
  return (
    <li
      ref={setNodeRef}
      data-od-id={`lists-item-${category.id}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center rounded-lg",
        isDragging && "bg-muted [&>*]:invisible",
      )}
    >
      <TextButton
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label="순서 바꾸기"
        aria-describedby={`${attributes["aria-describedby"]} category-drag-${category.id}`}
        disabled={disabled}
        className="min-h-11 min-w-11 shrink-0 touch-none cursor-grab text-[var(--icon-tertiary)] active:cursor-grabbing"
      >
        <Menu size={20} aria-hidden="true" />
      </TextButton>
      <span id={`category-drag-${category.id}`} className="sr-only">
        {category.name}
      </span>
      <TextButton
        className="min-h-11 min-w-0 flex-1 justify-start gap-3 text-foreground font-normal"
        onClick={() => onEdit(category)}
        disabled={disabled}
        aria-label={`${category.name} 수정하기`}
      >
        <CategoryContent category={category} />
      </TextButton>
    </li>
  );
}

export function SortableCategoryList({
  categories: serverCategories,
  onEdit,
}: {
  categories: EventCategory[];
  onEdit: (category: EventCategory) => void;
}) {
  const [toastOpen, setToastOpen] = useState(false);
  const onSaved = useCallback(() => setToastOpen(true), []);
  const {
    onMove,
    onDragStart: startOrdering,
    onDragCancel: cancelOrdering,
    localCategories,
    saving,
    error,
  } = useCategoryOrder(onSaved);
  const categories = localCategories ?? serverCategories;
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const onDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      setToastOpen(false);
      startOrdering(categories);
      setActiveId(String(active.id));
    },
    [categories, startOrdering],
  );
  const onDragCancel = useCallback(() => {
    setActiveId(null);
    cancelOrdering();
  }, [cancelOrdering]);
  const onDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      setActiveId(null);
      if (over) onMove(String(active.id), String(over.id));
      else cancelOrdering();
    },
    [cancelOrdering, onMove],
  );
  const activeCategory = categories.find(
    (category) => category.id === activeId,
  );
  return (
    <>
      {error && (
        <Text as="p" role="alert" className="mb-3 text-error-text">
          순서를 저장하지 못해 원래 순서로 되돌렸어요. {error.message}
        </Text>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragCancel={onDragCancel}
        onDragEnd={onDragEnd}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "스페이스로 집고 방향키로 이동한 뒤 스페이스로 놓으세요. ESC로 취소할 수 있어요.",
          },
          announcements: {
            onDragStart: ({ active }) =>
              `${categories.find((category) => category.id === active.id)?.name} 순서 변경을 시작해요.`,
            onDragOver: ({ over }) =>
              over
                ? `${categories.findIndex((category) => category.id === over.id) + 1}번째 위치예요.`
                : "목록 밖이에요.",
            onDragEnd: ({ over }) =>
              over ? undefined : "순서 변경을 취소했어요.",
            onDragCancel: () => "순서 변경을 취소했어요.",
          },
        }}
      >
        <SortableContext
          items={categories}
          strategy={verticalListSortingStrategy}
        >
          <List data-od-id="lists-items" aria-busy={saving}>
            {categories.map((category) => (
              <SortableCategoryRow
                key={category.id}
                category={category}
                onEdit={onEdit}
                disabled={saving}
              />
            ))}
          </List>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeCategory && (
            <div
              className="flex min-h-11 items-center gap-3 rounded-lg bg-background pr-3 shadow-[var(--shadow-fab)]"
              aria-hidden="true"
            >
              <span className="grid min-h-11 min-w-11 place-items-center text-[var(--icon-tertiary)]">
                <Menu size={20} />
              </span>
              <CategoryContent category={activeCategory} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
      <Toast
        open={toastOpen}
        onOpenChange={setToastOpen}
        message="순서를 저장했어요"
        duration={2000}
      />
    </>
  );
}
