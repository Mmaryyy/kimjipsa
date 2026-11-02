import { Button, Checkbox, QuantityStepper, TextButton } from "@/shared/ui";
import { Check, Link as LinkIcon, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import type { CartItem } from "@/entities/cart-item";
import { cn } from "@/shared/lib";

const swipeActionWidth = 96;

interface Props {
  item: CartItem;
  index: number;
  unit: string;
  checkedBy: string;
  editing: boolean;
  disabled: boolean;
  pending: boolean;
  selected: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: () => void;
  onPurchase: () => void;
  onQuantityChange: (quantity: number) => void;
  onCheck: () => void;
  onEdit: () => void;
  onDelete: () => void;
}
const CartItemRow = ({
  item,
  index,
  unit,
  checkedBy,
  editing,
  disabled,
  pending,
  selected,
  open,
  onOpenChange,
  onSelect,
  onPurchase,
  onQuantityChange,
  onCheck,
  onEdit,
  onDelete,
}: Props) => {
  const [quantityEditing, setQuantityEditing] = useState(false);
  const [offset, setOffset] = useState<number | null>(null);
  const gesture = useRef<{
    x: number;
    y: number;
    base: number;
    horizontal: boolean;
  } | null>(null);
  const dragged = useRef(false);
  const actionsOpen = open && !editing;
  const revealedWidth = editing
    ? 0
    : -(offset ?? (actionsOpen ? -swipeActionWidth : 0));
  const contentDisabled = disabled || actionsOpen;
  const finishSwipe = (cancelled: boolean) => {
    if (!gesture.current) return;
    if (gesture.current.horizontal)
      onOpenChange(!cancelled && (offset ?? 0) < -60);
    gesture.current = null;
    setOffset(null);
  };
  return (
    <li
      data-od-id={`cart-item-${index}`}
      aria-busy={pending}
      data-cart-row={item.id}
      className="relative overflow-hidden"
      onPointerDown={(event) => {
        if (disabled || editing || !event.isPrimary || event.button !== 0)
          return;
        dragged.current = false;
        gesture.current = {
          x: event.clientX,
          y: event.clientY,
          base: open ? -swipeActionWidth : 0,
          horizontal: false,
        };
      }}
      onPointerMove={(event) => {
        const start = gesture.current;
        if (!start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (!start.horizontal) {
          if (Math.abs(dy) > 8 && Math.abs(dy) >= Math.abs(dx)) {
            gesture.current = null;
            return;
          }
          if (Math.abs(dx) < 12 || Math.abs(dx) <= Math.abs(dy)) return;
          start.horizontal = true;
          dragged.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          onOpenChange(true);
        }
        setOffset(Math.max(-swipeActionWidth, Math.min(0, start.base + dx)));
      }}
      onPointerUp={() => finishSwipe(false)}
      onPointerCancel={() => finishSwipe(true)}
      onLostPointerCapture={(event) => {
        if (event.target === event.currentTarget) finishSwipe(true);
      }}
      onClickCapture={(event) => {
        if (dragged.current) {
          event.preventDefault();
          event.stopPropagation();
          dragged.current = false;
        }
      }}
    >
      <div
        className={cn([
          "absolute inset-y-0 right-0 z-10 flex items-center gap-4 px-2",
          "transition-transform motion-reduce:transition-none",
        ])}
        style={{
          width: swipeActionWidth,
          transform: `translateX(${swipeActionWidth - revealedWidth}px)`,
          transitionDuration: offset === null ? undefined : "0ms",
        }}
        inert={!open || editing || disabled}
        aria-hidden={!open || editing}
      >
        <Button
          size="icon-sm"
          aria-label={`${item.name} 구매 완료`}
          disabled={disabled}
          onClick={onPurchase}
        >
          <Check size={16} aria-hidden />
        </Button>
        <Button
          variant="danger"
          size="icon-sm"
          aria-label={`${item.name} 삭제`}
          disabled={disabled}
          onClick={onDelete}
        >
          <Trash2 size={16} aria-hidden />
        </Button>
      </div>
      <div
        className={cn([
          "relative flex min-h-11 touch-pan-y items-start gap-3 bg-background py-2",
          "transition-[padding] motion-reduce:transition-none",
        ])}
        style={{
          paddingRight: revealedWidth,
          transitionDuration: offset === null ? undefined : "0ms",
        }}
      >
        <Checkbox
          checked={editing ? selected : item.is_checked}
          disabled={contentDisabled}
          aria-label={`${item.name} ${editing ? "선택" : "담음"}`}
          onCheckedChange={editing ? onSelect : onCheck}
          className="mt-1"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <TextButton
              className={cn([
                "min-h-0 min-w-0 max-w-full shrink justify-start whitespace-normal",
                "p-0 text-left font-normal text-foreground",
              ])}
              onClick={onEdit}
              disabled={contentDisabled}
            >
              <span
                className={cn(
                  "break-words",
                  item.is_checked && "text-muted-foreground line-through",
                )}
              >
                {item.name}
              </span>
            </TextButton>
            {quantityEditing ? (
              <div className="-my-2 flex flex-wrap items-center gap-1">
                <QuantityStepper
                  label={item.name}
                  value={item.quantity}
                  min={Math.min(1, item.quantity)}
                  unit={unit}
                  allowDirectInput
                  disabled={contentDisabled}
                  onValueChange={onQuantityChange}
                />
                <TextButton
                  size="sm"
                  disabled={contentDisabled}
                  onClick={() => setQuantityEditing(false)}
                >
                  완료
                </TextButton>
              </div>
            ) : (
              <TextButton
                size="sm"
                className="-my-2 min-h-11 min-w-11 p-0 font-normal text-muted-foreground"
                aria-label={`${item.name} 수량 변경`}
                disabled={contentDisabled}
                onClick={() => setQuantityEditing(true)}
              >
                {item.quantity}
                {unit}
              </TextButton>
            )}
          </div>
          {item.memo && (
            <p className="mt-0.5 text-caption text-muted-foreground">
              {item.memo}
            </p>
          )}
          {item.link_url && (
            <a
              href={item.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-caption text-primary"
            >
              쇼핑몰 링크
              <LinkIcon size={12} aria-hidden />
            </a>
          )}
        </div>
        {pending && (
          <span role="status" className="text-caption text-muted-foreground">
            저장 중
          </span>
        )}
        {item.is_checked && (
          <span className="mt-1 shrink-0 text-caption text-muted-foreground">
            {checkedBy} 담음
          </span>
        )}
        {editing && (
          <div className="flex shrink-0 flex-row items-center gap-2">
            <TextButton
              size="sm"
              disabled={disabled}
              aria-label={`${item.name} 구매 완료`}
              onClick={onPurchase}
            >
              구매 완료
            </TextButton>
            <TextButton
              tone="danger"
              disabled={disabled}
              aria-label={`${item.name} 삭제`}
              onClick={onDelete}
            >
              <Trash2 size={16} aria-hidden />
            </TextButton>
          </div>
        )}
      </div>
    </li>
  );
};
export default CartItemRow;
