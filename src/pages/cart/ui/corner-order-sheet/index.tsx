"use client";
import { useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { InventoryMetaEntry } from "@/entities/inventory-item";
import { useCartActions } from "@/entities/cart-item";
import { List, Sheet, TextButton } from "@/shared/ui";
import CornerOrderRow from "./Row";
interface Props {
  categories: InventoryMetaEntry[];
  disabled: boolean;
  onClose: () => void;
}
const CornerOrderSheet = ({ categories, disabled, onClose }: Props) => {
  const [local, setLocal] = useState<InventoryMetaEntry[] | null>(null);
  const [error, setError] = useState("");
  const action = useCartActions();
  const ordered =
    local ?? [...categories].sort((a, b) => a.sort_order - b.sort_order);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !action.isPending) onClose();
      }}
      title="코너 순서"
      description="마트 동선에 맞춰 코너 순서를 바꿔요."
      odId="sheet-corner-order"
      action={
        <TextButton
          data-od-id="order-done"
          disabled={action.isPending}
          onClick={onClose}
        >
          완료
        </TextButton>
      }
    >
      <p className="mb-3 text-caption text-muted-foreground">
        마트 동선에 맞춰 바꿔 두면 장보기 목록도 이 순서로 묶여요.
      </p>
      {error && (
        <p role="alert" className="text-caption text-error-text">
          {error}
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          if (!over || active.id === over.id || disabled || action.isPending)
            return;
          const updated = arrayMove(
            ordered,
            ordered.findIndex((entry) => entry.id === active.id),
            ordered.findIndex((entry) => entry.id === over.id),
          );
          setLocal(updated);
          setError("");
          action.mutate(
            { action: "order", ids: updated.map((entry) => entry.id) },
            {
              onSuccess: () => setLocal(null),
              onError: (reason) => {
                setLocal(null);
                setError(reason.message);
              },
            },
          );
        }}
      >
        <SortableContext items={ordered} strategy={verticalListSortingStrategy}>
          <List>
            {ordered.map((entry, index) => (
              <CornerOrderRow
                key={entry.id}
                id={entry.id}
                name={entry.name}
                index={index}
                disabled={disabled || action.isPending}
              />
            ))}
          </List>
        </SortableContext>
      </DndContext>
    </Sheet>
  );
};
export default CornerOrderSheet;
