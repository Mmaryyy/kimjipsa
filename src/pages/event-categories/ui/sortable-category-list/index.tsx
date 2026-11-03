"use client";
import { useCallback, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { EventCategory } from "@/entities/event";
import { CategoryDot, Text, Toast } from "@/shared/ui";
import SortableList from "@/shared/ui/sortable-list";
import { useCategoryOrder } from "../../model/use-category-order";

const CategoryContent = ({ category }: { category: EventCategory }) => {
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
};

interface Props {
  categories: EventCategory[];
  onEdit: (category: EventCategory) => void;
}
const SortableCategoryList = ({
  categories: serverCategories,
  onEdit,
}: Props) => {
  const [toastOpen, setToastOpen] = useState(false);
  const onSaved = useCallback(() => setToastOpen(true), []);
  const order = useCategoryOrder(onSaved);
  return (
    <>
      {order.error && (
        <Text as="p" role="alert" className="mb-3 text-error-text">
          순서를 저장하지 못해 원래 순서로 되돌렸어요. {order.error.message}
        </Text>
      )}
      <SortableList
        items={order.localCategories ?? serverCategories}
        onEdit={onEdit}
        renderItem={(category) => <CategoryContent category={category} />}
        busy={order.saving}
        onDragStart={(categories) => {
          setToastOpen(false);
          order.onDragStart(categories);
        }}
        onDragCancel={order.onDragCancel}
        onMove={order.onMove}
      />
      <Toast
        open={toastOpen}
        onOpenChange={setToastOpen}
        message="순서를 저장했어요"
        duration={2000}
      />
    </>
  );
};
export default SortableCategoryList;
