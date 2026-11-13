import {
  Badge,
  Button,
  Checkbox,
  Loader,
  QuantityStepper,
  TextButton,
  SwipeActionRow,
} from "@/shared/ui";
import {
  Check,
  Link as LinkIcon,
  ShoppingCartPlus,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

import type { CartItem } from "@/entities/cart-item";
import { cn } from "@/shared/lib";

interface Props {
  item: CartItem;
  index: number;
  unit: string;
  checkedBy: string;
  disabled: boolean;
  pending: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  disabled,
  pending,
  open,
  onOpenChange,
  onPurchase,
  onQuantityChange,
  onCheck,
  onEdit,
  onDelete,
}: Props) => {
  const [delayedPending, setDelayedPending] = useState(false);
  useEffect(() => {
    const timer = setTimeout(
      () => setDelayedPending(pending),
      pending ? 300 : 0,
    );
    return () => clearTimeout(timer);
  }, [pending]);
  const showSaving = pending && delayedPending;
  const [quantityEditing, setQuantityEditing] = useState(false);
  return (
    <SwipeActionRow
      label={`${item.name} 동작`}
      data-od-id={`cart-item-${index}`}
      aria-busy={pending}
      data-cart-row={item.id}
      inertContent={false}
      open={open}
      onOpenChange={onOpenChange}
      disabled={disabled}
      actions={[
        <Button
          key="purchase"
          size="icon-sm"
          aria-label={`${item.name} 구매 완료`}
          disabled={disabled}
          onClick={onPurchase}
        >
          <Check size={16} aria-hidden />
        </Button>,
        <Button
          key="delete"
          variant="danger"
          size="icon-sm"
          aria-label={`${item.name} 삭제`}
          disabled={disabled}
          onClick={onDelete}
        >
          <Trash2 size={16} aria-hidden />
        </Button>,
      ]}
      contentClassName={cn(
        "flex min-h-11 items-start gap-3 py-2 transition-[padding,opacity]",
        showSaving && "opacity-70",
      )}
    >
      {(contentDisabled) => (
        <>
          <Checkbox
            checked={item.is_checked}
            disabled={contentDisabled}
            aria-label={`${item.name} 담음`}
            onCheckedChange={onCheck}
            className="mt-1"
          />
          {showSaving && (
            <Loader
              className={cn(
                "pointer-events-none absolute top-3 left-0 size-5",
                item.is_checked ? "text-primary-foreground" : "text-primary",
              )}
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex min-h-7 items-center gap-x-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <TextButton
                  className={cn([
                    "-my-2 min-h-11 min-w-0 max-w-full shrink justify-start",
                    "p-0 text-left font-normal text-foreground",
                  ])}
                  onClick={onEdit}
                  disabled={contentDisabled}
                >
                  <span
                    className={cn(
                      "line-clamp-2 break-words whitespace-normal",
                      item.is_checked && "text-muted-foreground line-through",
                    )}
                  >
                    {item.name}
                  </span>
                </TextButton>
                {item.is_checked && (
                  <Badge className="text-muted-foreground">
                    <ShoppingCartPlus aria-hidden className="size-[1em]" />
                    {checkedBy} 님<span className="sr-only"> 담음</span>
                  </Badge>
                )}
              </div>
              <div className="-my-2 inline-flex shrink-0 items-center">
                <QuantityStepper
                  collapsible={{
                    open: quantityEditing,
                    onOpenChange: setQuantityEditing,
                  }}
                  label={item.name}
                  value={item.quantity}
                  min={Math.min(1, item.quantity)}
                  unit={unit}
                  allowDirectInput
                  disabled={contentDisabled}
                  onValueChange={onQuantityChange}
                />
              </div>
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
            <span role="status" className="sr-only">
              저장 중
            </span>
          )}
        </>
      )}
    </SwipeActionRow>
  );
};
export default CartItemRow;
