import { cn } from "@/shared/lib";
import { Link as LinkIcon, Trash2 } from "lucide-react";
import type { CartItem } from "@/entities/cart-item";
import { Checkbox, TextButton } from "@/shared/ui";
interface Props {
  item: CartItem;
  index: number;
  unit: string;
  checkedBy: string;
  editing: boolean;
  disabled: boolean;
  pending: boolean;
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
  onCheck,
  onEdit,
  onDelete,
}: Props) => {
  return (
    <li
      data-od-id={`cart-item-${index}`}
      aria-busy={pending}
      className="flex min-h-11 items-start gap-3 py-2"
    >
      <Checkbox
        checked={item.is_checked}
        disabled={disabled}
        aria-label={`${item.name} 담음`}
        onCheckedChange={onCheck}
        className="mt-1"
      />
      <div className="min-w-0 flex-1">
        <TextButton
          className="min-h-0 justify-start p-0 text-left font-normal text-foreground"
          onClick={onEdit}
          disabled={disabled}
        >
          <span
            className={cn(
              "break-words",
              item.is_checked && "text-muted-foreground line-through",
            )}
          >
            {item.name}{" "}
            <span className="ml-1 text-body-sm text-muted-foreground">
              {item.quantity}
              {unit}
            </span>
          </span>
        </TextButton>
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
        <TextButton
          tone="danger"
          disabled={disabled}
          aria-label={`${item.name} 삭제`}
          onClick={onDelete}
        >
          <Trash2 size={16} aria-hidden />
        </TextButton>
      )}
    </li>
  );
};
export default CartItemRow;
