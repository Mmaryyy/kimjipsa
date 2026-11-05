import { useEffect } from "react";
import { cn, setCartActionsVisible } from "@/shared/lib";
import { Button } from "@/shared/ui";
interface Props {
  count: number;
  busy: boolean;
  onPurchase: () => void;
  onDelete: () => void;
}
const CartCheckedActions = ({ count, busy, onPurchase, onDelete }: Props) => {
  const hidden = count === 0;
  useEffect(() => {
    setCartActionsVisible(!hidden);
    return () => setCartActionsVisible(false);
  }, [hidden]);
  return (
    <div
      data-od-id="cart-actions"
      data-cart-actions-visible={!hidden}
      aria-hidden={hidden}
      inert={hidden}
      className={cn(
        "fixed inset-x-3 z-40 flex justify-end gap-2 lg:inset-x-auto lg:bottom-6 lg:w-130",
        "bottom-[calc(var(--bottom-navigation-offset)+env(safe-area-inset-bottom)-var(--sp-3))]",
        "transition-[opacity,translate] duration-[var(--dur-slow)] ease-[var(--ease)]",
        "motion-reduce:translate-none motion-reduce:transition-none",
        hidden && "pointer-events-none translate-y-2.5 opacity-0",
      )}
    >
      <Button
        variant="glass"
        className="text-primary"
        tabIndex={hidden ? -1 : undefined}
        disabled={busy}
        onClick={onPurchase}
      >
        구매 완료({count})
      </Button>
      <Button
        variant="glass"
        className="text-error-text"
        tabIndex={hidden ? -1 : undefined}
        disabled={busy}
        onClick={onDelete}
      >
        삭제
      </Button>
    </div>
  );
};
export default CartCheckedActions;
