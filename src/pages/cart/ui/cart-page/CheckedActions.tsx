import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui";
interface Props {
  count: number;
  busy: boolean;
  onPurchase: () => void;
  onDelete: () => void;
}
const CartCheckedActions = ({ count, busy, onPurchase, onDelete }: Props) => (
  <div
    data-od-id="cart-actions"
    className={cn([
      "sticky top-[env(safe-area-inset-top)] z-20 flex h-14 shrink-0",
      "items-center justify-end gap-2 bg-background",
    ])}
  >
    {count > 0 && (
      <>
        <Button size="sm" disabled={busy} onClick={onPurchase}>
          구매 완료({count})
        </Button>
        <Button size="sm" variant="danger" disabled={busy} onClick={onDelete}>
          삭제
        </Button>
      </>
    )}
  </div>
);
export default CartCheckedActions;
