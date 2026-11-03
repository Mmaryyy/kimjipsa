"use client";
import { useCallback, useId, useState, type ReactNode } from "react";
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
import { Menu } from "lucide-react";
import { cn } from "@/shared/lib";
import { List } from "../list";
import { TextButton } from "../text-button";

interface SortableItem {
  id: string;
  name: string;
}
interface RowProps<T extends SortableItem> {
  item: T;
  onEdit: (item: T) => void;
  disabled: boolean;
  renderItem: (item: T) => ReactNode;
}
const SortableListRow = <T extends SortableItem>({
  item,
  onEdit,
  disabled,
  renderItem,
}: RowProps<T>) => {
  const descriptionId = useId();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled });
  return (
    <li
      ref={setNodeRef}
      data-od-id={`lists-item-${item.id}`}
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
        aria-describedby={`${attributes["aria-describedby"]} ${descriptionId}`}
        disabled={disabled}
        className="min-h-11 min-w-11 shrink-0 touch-none cursor-grab text-[var(--icon-tertiary)] active:cursor-grabbing"
      >
        <Menu size={20} aria-hidden="true" />
      </TextButton>
      <span id={descriptionId} className="sr-only">
        {item.name}
      </span>
      <TextButton
        className="min-h-11 min-w-0 flex-1 justify-start gap-3 text-foreground font-normal"
        onClick={() => onEdit(item)}
        disabled={disabled}
        aria-label={`${item.name} 수정하기`}
      >
        {renderItem(item)}
      </TextButton>
    </li>
  );
};

interface Props<T extends SortableItem> {
  items: T[];
  onEdit: (item: T) => void;
  renderItem: (item: T) => ReactNode;
  disabled?: boolean;
  busy?: boolean;
  onMove: (activeId: string, overId: string) => void;
  onDragStart?: (items: T[]) => void;
  onDragCancel?: () => void;
}
const SortableList = <T extends SortableItem>({
  items,
  onEdit,
  renderItem,
  disabled = false,
  busy = false,
  onMove,
  onDragStart: startOrdering,
  onDragCancel: cancelOrdering,
}: Props<T>) => {
  const contextId = useId();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const onDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      startOrdering?.(items);
      setActiveId(String(active.id));
    },
    [items, startOrdering],
  );
  const onDragCancel = useCallback(() => {
    setActiveId(null);
    cancelOrdering?.();
  }, [cancelOrdering]);
  const onDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      setActiveId(null);
      if (over && !disabled && !busy)
        onMove(String(active.id), String(over.id));
      else cancelOrdering?.();
    },
    [busy, cancelOrdering, disabled, onMove],
  );
  const activeItem = items.find((item) => item.id === activeId);
  return (
    <>
      <DndContext
        id={contextId}
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
              `${items.find((item) => item.id === active.id)?.name} 순서 변경을 시작해요.`,
            onDragOver: ({ over }) =>
              over
                ? `${items.findIndex((item) => item.id === over.id) + 1}번째 위치예요.`
                : "목록 밖이에요.",
            onDragEnd: ({ over }) =>
              over ? undefined : "순서 변경을 취소했어요.",
            onDragCancel: () => "순서 변경을 취소했어요.",
          },
        }}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <List data-od-id="lists-items" aria-busy={busy}>
            {items.map((item) => (
              <SortableListRow
                key={item.id}
                item={item}
                onEdit={onEdit}
                disabled={disabled || busy}
                renderItem={renderItem}
              />
            ))}
          </List>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeItem && (
            <div
              className="flex min-h-11 items-center gap-3 rounded-lg bg-background pr-3 shadow-[var(--shadow-fab)]"
              aria-hidden="true"
            >
              <span className="grid min-h-11 min-w-11 place-items-center text-[var(--icon-tertiary)]">
                <Menu size={20} />
              </span>
              {renderItem(activeItem)}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </>
  );
};
export default SortableList;
